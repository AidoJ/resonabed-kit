import type { SupabaseClient } from "@supabase/supabase-js";

export type PractitionerFlag =
  | "manage_clients"
  | "view_all_clients"
  | "manage_bookings"
  | "complete_unpaid";

/**
 * Server-side enforcement of per-org practitioner permission toggles.
 *
 * - super_admin and org_admin of the org: always allowed.
 * - practitioner: allowed only when the org has the corresponding toggle on.
 *
 * These toggles cannot be bypassed by calling the server function directly —
 * the UI hides/disables the affordance but this is the real gate.
 */
export async function assertPractitionerAction(
  ctx: { supabase: SupabaseClient; userId: string },
  orgId: string,
  flag: PractitionerFlag,
): Promise<void> {
  const { data: roles, error } = await ctx.supabase
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const list = roles ?? [];
  if (list.some((r) => r.role === "super_admin")) return;
  if (list.some((r) => r.role === "org_admin" && r.org_id === orgId)) return;
  // Practitioner (or anything else) — must check the org flag.
  const { data: allowed, error: fnErr } = await ctx.supabase.rpc(
    "org_practitioner_permission",
    { _org_id: orgId, _flag: flag },
  );
  if (fnErr) throw new Error(fnErr.message);
  if (!allowed) {
    throw new Error(
      "Your organisation admin has disabled this action for practitioners.",
    );
  }
}

/**
 * Compute the effective permission set for the calling user, for the UI.
 * Admins / super_admins get true for everything; practitioners reflect
 * their org's toggles.
 */
export async function computePractitionerPermissions(
  ctx: { supabase: SupabaseClient; userId: string },
  orgId: string | null,
): Promise<{ manageClients: boolean; viewAllClients: boolean; manageBookings: boolean }> {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", ctx.userId);
  const list = roles ?? [];
  const isAdmin =
    list.some((r) => r.role === "super_admin") ||
    (!!orgId && list.some((r) => r.role === "org_admin" && r.org_id === orgId));
  if (isAdmin) {
    return { manageClients: true, viewAllClients: true, manageBookings: true };
  }
  if (!orgId) {
    return { manageClients: false, viewAllClients: false, manageBookings: false };
  }
  const { data: org } = await ctx.supabase
    .from("organisations")
    .select(
      "practitioners_can_manage_clients, practitioners_can_view_all_clients, practitioners_can_manage_bookings",
    )
    .eq("id", orgId)
    .maybeSingle();
  return {
    manageClients: (org?.practitioners_can_manage_clients ?? true) as boolean,
    viewAllClients: (org?.practitioners_can_view_all_clients ?? true) as boolean,
    manageBookings: (org?.practitioners_can_manage_bookings ?? true) as boolean,
  };
}
