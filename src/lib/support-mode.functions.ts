import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function requireSuperAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export interface ActiveSupportSession {
  id: string;
  org_id: string;
  org_name: string;
  reason: string | null;
  entered_at: string;
  emergency: boolean;
}

export const getActiveSupportSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveSupportSession | null> => {
    const { data, error } = await context.supabase
      .from("support_sessions")
      .select("id, org_id, reason, entered_at, emergency, organisations:org_id(name)")
      .eq("super_admin_id", context.userId)
      .is("exited_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const org = data.organisations as { name: string } | null;
    return {
      id: data.id as string,
      org_id: data.org_id as string,
      org_name: org?.name ?? "Organisation",
      reason: (data.reason as string | null) ?? null,
      entered_at: data.entered_at as string,
      emergency: Boolean(data.emergency),
    };
  });

export const enterSupportMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        org_id: uuid,
        reason: z.string().trim().min(3).max(500),
        emergency: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ActiveSupportSession> => {
    await requireSuperAdmin(context);

    // Look up an active grant for this org.
    const { data: grant } = await context.supabase
      .from("support_access_grants")
      .select("id, expires_at, revoked_at")
      .eq("org_id", data.org_id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!grant && !data.emergency) {
      throw new Error(
        "This organisation has not granted support access. Ask an org admin to grant access from Settings, or use emergency access if they are locked out.",
      );
    }

    // Close any stale open session first (defensive; unique index enforces one).
    await context.supabase
      .from("support_sessions")
      .update({ exited_at: new Date().toISOString() })
      .eq("super_admin_id", context.userId)
      .is("exited_at", null);

    const { data: row, error } = await context.supabase
      .from("support_sessions")
      .insert({
        super_admin_id: context.userId,
        org_id: data.org_id,
        reason: data.reason,
        emergency: data.emergency && !grant,
        grant_id: grant?.id ?? null,
      })
      .select("id, org_id, reason, entered_at, emergency, organisations:org_id(name)")
      .single();
    if (error) throw new Error(error.message);
    const org = row.organisations as { name: string } | null;
    return {
      id: row.id as string,
      org_id: row.org_id as string,
      org_name: org?.name ?? "Organisation",
      reason: (row.reason as string | null) ?? null,
      entered_at: row.entered_at as string,
      emergency: Boolean(row.emergency),
    };
  });

export const exitSupportMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase
      .from("support_sessions")
      .update({ exited_at: new Date().toISOString() })
      .eq("super_admin_id", context.userId)
      .is("exited_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Support-access history for an organisation — visible to that org's admins
 * (the trust artifact) and to super_admin.
 */
export const listSupportSessionsForOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("support_sessions")
      .select("id, super_admin_id, reason, entered_at, exited_at, emergency, grant_id")
      .eq("org_id", data.org_id)
      .order("entered_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
