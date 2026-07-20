import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export interface PlatformMetrics {
  orgs: {
    total: number;
    active: number;
    suspended: number;
    configured: number;
    unconfigured: number;
  };
  licences: {
    trial: number;
    active: number;
    expired: number;
    expiring_30d: number;
  };
  perOrg: Array<{
    org_id: string;
    org_name: string;
    session_count_30d: number;
    session_count_total: number;
    revenue_total: number;
    licence_status: "trial" | "active" | "expired";
    licence_expires_at: string | null;
  }>;
  totals: {
    sessions_30d: number;
    sessions_total: number;
    revenue_total: number;
    bookings_total: number;
    bookings_30d: number;
    new_orgs_30d: number;
  };
}

/**
 * Aggregate platform metrics — NO individual client/session rows, ever.
 * Only counts and sums, grouped by org.
 */
export const getPlatformMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformMetrics> => {
    await requireSuperAdmin(context);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const thirtyAgo = new Date(now - 30 * DAY).toISOString();

    const [
      { data: orgs },
      { data: sessions30 },
      { data: sessionsAll },
      { count: bookingsTotal },
      { count: bookings30 },
      { count: newOrgs30 },
    ] = await Promise.all([
      context.supabase
        .from("organisations")
        .select("id, name, status, is_configured, music_licence_status, music_licence_expires_at, created_at")
        .order("name"),
      context.supabase
        .from("sessions")
        .select("org_id")
        .gte("created_at", thirtyAgo),
      context.supabase
        .from("sessions")
        .select("org_id, payment_amount, status"),
      context.supabase.from("bookings").select("*", { count: "exact", head: true }),
      context.supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .gte("starts_at", thirtyAgo),
      context.supabase
        .from("organisations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyAgo),
    ]);

    const sess30 = new Map<string, number>();
    for (const s of sessions30 ?? []) {
      const k = s.org_id as string;
      sess30.set(k, (sess30.get(k) ?? 0) + 1);
    }
    const sessTot = new Map<string, number>();
    const revenue = new Map<string, number>();
    for (const s of sessionsAll ?? []) {
      const k = s.org_id as string;
      sessTot.set(k, (sessTot.get(k) ?? 0) + 1);
      if (s.status === "completed" && s.payment_amount) {
        revenue.set(k, (revenue.get(k) ?? 0) + Number(s.payment_amount));
      }
    }

    let trial = 0, active = 0, expired = 0, expiring = 0;
    let configured = 0, unconfigured = 0, activeOrgs = 0, suspended = 0;
    const perOrg: PlatformMetrics["perOrg"] = [];
    for (const o of orgs ?? []) {
      if (o.status === "suspended") suspended++;
      else activeOrgs++;
      if (o.is_configured) configured++;
      else unconfigured++;
      const status = (o.music_licence_status as "trial" | "active" | "expired") ?? "trial";
      const expIso = o.music_licence_expires_at as string | null;
      const expMs = expIso ? new Date(expIso).getTime() : null;
      const effectivelyExpired =
        status === "expired" || expMs === null || expMs <= now;
      if (effectivelyExpired) expired++;
      else if (status === "trial") trial++;
      else active++;
      if (!effectivelyExpired && expMs !== null && expMs - now < 30 * DAY) expiring++;

      perOrg.push({
        org_id: o.id as string,
        org_name: o.name as string,
        session_count_30d: sess30.get(o.id as string) ?? 0,
        session_count_total: sessTot.get(o.id as string) ?? 0,
        revenue_total: revenue.get(o.id as string) ?? 0,
        licence_status: status,
        licence_expires_at: expIso,
      });
    }

    perOrg.sort((a, b) => b.session_count_30d - a.session_count_30d);

    return {
      orgs: { total: (orgs ?? []).length, active: activeOrgs, suspended, configured, unconfigured },
      licences: { trial, active, expired, expiring_30d: expiring },
      perOrg,
      totals: {
        sessions_30d: (sessions30 ?? []).length,
        sessions_total: (sessionsAll ?? []).length,
        revenue_total: perOrg.reduce((a, b) => a + b.revenue_total, 0),
        bookings_total: bookingsTotal ?? 0,
        bookings_30d: bookings30 ?? 0,
        new_orgs_30d: newOrgs30 ?? 0,
      },
    };
  });
