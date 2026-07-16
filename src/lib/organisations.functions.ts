import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type OrgRow = {
  id: string;
  name: string;
  status: "active" | "suspended";
  brand_color: string | null;
  logo_path: string | null;
  is_template: boolean;
  is_configured: boolean;
  created_at: string;
  user_count: number;
  session_count_30d: number;
  music_licence_status: "trial" | "active" | "expired";
  music_licence_plan: "none" | "basic" | "pro";
  music_licence_expires_at: string | null;
  music_licence_note: string | null;
  music_licence_effective: "ok" | "expired";
  music_licence_days_remaining: number | null;
};

export const listOrganisations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgRow[]> => {
    await requireSuperAdmin(context);
    const { data: orgs, error } = await context.supabase
      .from("organisations")
      .select(
        "id, name, status, brand_color, logo_path, is_template, is_configured, created_at, music_licence_status, music_licence_plan, music_licence_expires_at, music_licence_note",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!orgs || orgs.length === 0) return [];

    const orgIds = orgs.map((o) => o.id as string);
    const [{ data: profs }, { data: sess }] = await Promise.all([
      context.supabase.from("profiles").select("org_id").in("org_id", orgIds),
      context.supabase
        .from("sessions")
        .select("org_id, created_at")
        .in("org_id", orgIds)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const userCounts = new Map<string, number>();
    for (const p of profs ?? []) {
      const k = p.org_id as string;
      userCounts.set(k, (userCounts.get(k) ?? 0) + 1);
    }
    const sessCounts = new Map<string, number>();
    for (const s of sess ?? []) {
      const k = s.org_id as string;
      sessCounts.set(k, (sessCounts.get(k) ?? 0) + 1);
    }

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    return orgs.map((o) => {
      const expIso = (o.music_licence_expires_at as string | null) ?? null;
      const expMs = expIso ? new Date(expIso).getTime() : null;
      const rawStatus = (o.music_licence_status as "trial" | "active" | "expired") ?? "trial";
      const effective: "ok" | "expired" =
        rawStatus !== "expired" && expMs !== null && expMs > now ? "ok" : "expired";
      return {
        id: o.id as string,
        name: o.name as string,
        status: o.status as "active" | "suspended",
        brand_color: (o.brand_color as string | null) ?? null,
        logo_path: (o.logo_path as string | null) ?? null,
        is_template: !!o.is_template,
        is_configured: !!o.is_configured,
        created_at: o.created_at as string,
        user_count: userCounts.get(o.id as string) ?? 0,
        session_count_30d: sessCounts.get(o.id as string) ?? 0,
        music_licence_status: rawStatus,
        music_licence_plan: (o.music_licence_plan as "none" | "basic" | "pro") ?? "none",
        music_licence_expires_at: expIso,
        music_licence_note: (o.music_licence_note as string | null) ?? null,
        music_licence_effective: effective,
        music_licence_days_remaining:
          expMs !== null ? Math.max(0, Math.ceil((expMs - now) / DAY)) : null,
      };
    });
  });

