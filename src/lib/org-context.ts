import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Effective organisation id for the calling user.
 *
 * - Regular org members / practitioners: their profile.org_id.
 * - Super admin with NO open support session: null (no clinic context).
 * - Super admin with an OPEN support session: the org_id being supported.
 *
 * This is the ONLY server-side way super_admin gets scoped into a specific
 * clinic. Support sessions are logged in the append-only support_sessions
 * audit table and every entry/exit is permanent.
 */
export async function resolveEffectiveOrgId(ctx: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ orgId: string | null; supportMode: boolean }> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("org_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (profile?.org_id) return { orgId: profile.org_id as string, supportMode: false };

  // No profile org, could be super_admin. Look for an open support session.
  const { data: support } = await ctx.supabase
    .from("support_sessions")
    .select("org_id")
    .eq("super_admin_id", ctx.userId)
    .is("exited_at", null)
    .maybeSingle();
  return { orgId: (support?.org_id as string | undefined) ?? null, supportMode: !!support };
}
