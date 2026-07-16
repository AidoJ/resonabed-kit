import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export type LicenceStatus = "trial" | "active" | "expired";
export type LicencePlan = "none" | "basic" | "pro";

export interface LicenceState {
  status: LicenceStatus;
  plan: LicencePlan;
  expires_at: string | null;
  note: string | null;
  is_ok: boolean;
}

async function requireSuperAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

function compute(row: {
  music_licence_status: LicenceStatus;
  music_licence_plan: LicencePlan;
  music_licence_expires_at: string | null;
  music_licence_note: string | null;
}): LicenceState {
  const exp = row.music_licence_expires_at
    ? new Date(row.music_licence_expires_at).getTime()
    : 0;
  const is_ok = row.music_licence_status !== "expired" && exp > Date.now();
  return {
    status: row.music_licence_status,
    plan: row.music_licence_plan,
    expires_at: row.music_licence_expires_at,
    note: row.music_licence_note,
    is_ok,
  };
}

/**
 * Anyone in an org (org_admin, practitioner, super_admin viewing their own
 * profile org) can read licence state for their own organisation.
 */
export const getMyOrgLicence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenceState | null> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) return null;
    const { data, error } = await context.supabase
      .from("organisations")
      .select(
        "music_licence_status, music_licence_plan, music_licence_expires_at, music_licence_note",
      )
      .eq("id", profile.org_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return compute(data as never);
  });

/**
 * Extend an organisation's music licence. Stacks: adds `months` on top of the
 * later of (now, current expires_at). Sets status to `active` when the new
 * expiry is in the future. Optional `plan` label and `note` for record.
 */
export const extendMusicLicence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        org_id: uuid,
        months: z.number().int().min(1).max(120),
        plan: z.enum(["none", "basic", "pro"]).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);

    const { data: org, error: fErr } = await context.supabase
      .from("organisations")
      .select(
        "music_licence_expires_at, music_licence_plan, music_licence_note, music_licence_status",
      )
      .eq("id", data.org_id)
      .single();
    if (fErr) throw new Error(fErr.message);

    const now = new Date();
    const currentExp = org.music_licence_expires_at
      ? new Date(org.music_licence_expires_at as string)
      : now;
    const base = currentExp.getTime() > now.getTime() ? currentExp : now;

    // Add N calendar months, preserving day-of-month where possible.
    const newExp = new Date(base);
    newExp.setUTCMonth(newExp.getUTCMonth() + data.months);

    const status: LicenceStatus = newExp.getTime() > now.getTime() ? "active" : "expired";

    const { error: uErr } = await context.supabase
      .from("organisations")
      .update({
        music_licence_expires_at: newExp.toISOString(),
        music_licence_status: status,
        music_licence_plan: data.plan ?? (org.music_licence_plan as LicencePlan),
        music_licence_note: data.note ?? (org.music_licence_note as string | null),
      })
      .eq("id", data.org_id);
    if (uErr) throw new Error(uErr.message);

    return {
      expires_at: newExp.toISOString(),
      status,
      months_added: data.months,
    };
  });

/**
 * Immediately expire an organisation's music licence. Leaves plan and note
 * intact so history is preserved.
 */
export const expireMusicLicence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ org_id: uuid, note: z.string().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase
      .from("organisations")
      .update({
        music_licence_status: "expired" as const,
        music_licence_expires_at: new Date().toISOString(),
        ...(data.note !== undefined ? { music_licence_note: data.note } : {}),
      })
      .eq("id", data.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
