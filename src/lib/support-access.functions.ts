import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export interface SupportAccessGrant {
  id: string;
  org_id: string;
  granted_by: string;
  granted_by_name: string | null;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface SupportAccessHistory {
  id: string;
  super_admin_id: string;
  super_admin_name: string | null;
  reason: string | null;
  entered_at: string;
  exited_at: string | null;
  emergency: boolean;
  grant_id: string | null;
}

async function orgIdForCaller(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("profiles")
    .select("org_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

async function assertOrgAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}, orgId: string) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("org_id", orgId)
    .eq("role", "org_admin")
    .maybeSingle();
  if (!data) throw new Error("Only org admins can manage support access.");
}

/** Fetch the current active grant (if any) plus recent grants for an org. */
export const listSupportAccessForOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: uuid.optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    let orgId = data.org_id ?? null;
    if (!orgId) orgId = await orgIdForCaller(context);
    if (!orgId) return { active: null, history: [] as SupportAccessGrant[] };

    const { data: rows, error } = await context.supabase
      .from("support_access_grants")
      .select("id, org_id, granted_by, granted_at, expires_at, revoked_at")
      .eq("org_id", orgId)
      .order("granted_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.granted_by as string)));
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      for (const p of profs ?? []) names.set(p.id as string, (p.display_name as string) ?? null);
    }

    const now = Date.now();
    const list: SupportAccessGrant[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      org_id: r.org_id as string,
      granted_by: r.granted_by as string,
      granted_by_name: names.get(r.granted_by as string) ?? null,
      granted_at: r.granted_at as string,
      expires_at: r.expires_at as string,
      revoked_at: (r.revoked_at as string | null) ?? null,
    }));
    const active =
      list.find(
        (g) => !g.revoked_at && new Date(g.expires_at).getTime() > now,
      ) ?? null;
    return { active, history: list };
  });

export const grantSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        hours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await orgIdForCaller(context);
    if (!orgId) throw new Error("No organisation for this account.");
    await assertOrgAdmin(context, orgId);

    // Revoke any currently active grant so the newest one is authoritative.
    await context.supabase
      .from("support_access_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("org_id", orgId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());

    const expiresAt = new Date(Date.now() + data.hours * 3600 * 1000).toISOString();
    const { error } = await context.supabase.from("support_access_grants").insert({
      org_id: orgId,
      granted_by: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true, expires_at: expiresAt };
  });

export const revokeSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ grant_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const orgId = await orgIdForCaller(context);
    if (!orgId) throw new Error("No organisation for this account.");
    await assertOrgAdmin(context, orgId);
    const { error } = await context.supabase
      .from("support_access_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", data.grant_id)
      .eq("org_id", orgId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** History of support sessions (entries) for an org, the trust artifact. */
export const listSupportSessionsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: uuid.optional().nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<SupportAccessHistory[]> => {
    let orgId = data.org_id ?? null;
    if (!orgId) orgId = await orgIdForCaller(context);
    if (!orgId) return [];

    const { data: rows, error } = await context.supabase
      .from("support_sessions")
      .select("id, super_admin_id, reason, entered_at, exited_at, emergency, grant_id")
      .eq("org_id", orgId)
      .order("entered_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.super_admin_id as string)));
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      for (const p of profs ?? []) names.set(p.id as string, (p.display_name as string) ?? null);
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      super_admin_id: r.super_admin_id as string,
      super_admin_name: names.get(r.super_admin_id as string) ?? null,
      reason: (r.reason as string | null) ?? null,
      entered_at: r.entered_at as string,
      exited_at: (r.exited_at as string | null) ?? null,
      emergency: Boolean(r.emergency),
      grant_id: (r.grant_id as string | null) ?? null,
    }));
  });

/** Super-admin: check if a given org has an active grant right now. */
export const checkOrgSupportGrantForSuper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { data: grant } = await context.supabase
      .from("support_access_grants")
      .select("id, expires_at")
      .eq("org_id", data.org_id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      active: !!grant,
      expires_at: (grant?.expires_at as string | undefined) ?? null,
    };
  });
