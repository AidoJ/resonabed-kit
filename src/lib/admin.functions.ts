import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// Shared helper: ensure caller is org_admin or super_admin.
async function requireAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const [{ data: superRow }, { data: adminRows }] = await Promise.all([
    context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle(),
    context.supabase
      .from("user_roles")
      .select("org_id")
      .eq("user_id", context.userId)
      .eq("role", "org_admin"),
  ]);
  const isSuper = !!superRow;
  const adminOrgs = new Set((adminRows ?? []).map((r) => r.org_id as string));
  if (!isSuper && adminOrgs.size === 0) throw new Error("Forbidden");
  return { isSuper, adminOrgs };
}

// ---------- Services CRUD ----------

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, duration_minutes, price, is_active, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().min(1).max(160),
        duration_minutes: z.number().int().min(1).max(600),
        price: z.number().min(0).max(100000),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("No organisation");
    if (data.id) {
      const { error } = await context.supabase
        .from("services")
        .update({
          name: data.name,
          duration_minutes: data.duration_minutes,
          price: data.price,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("services")
      .insert({
        org_id: profile.org_id,
        name: data.name,
        duration_minutes: data.duration_minutes,
        price: data.price,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Team list ----------

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("id, display_name, is_active, org_id")
          .order("display_name"),
        context.supabase.from("user_roles").select("user_id, role"),
      ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id as string) ?? [];
      arr.push(r.role as string);
      rolesByUser.set(r.user_id as string, arr);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      is_active: p.is_active,
      org_id: p.org_id,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

// ---------- Clients (admin view) ----------

export const listClientsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let q = context.supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, date_of_birth, created_at")
      .order("last_name");
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        first_name: z.string().min(1).max(80),
        last_name: z.string().min(1).max(80),
        email: z.string().email().max(160).nullable().optional(),
        phone: z.string().max(40).nullable().optional(),
        date_of_birth: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("No organisation");
    const payload = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("clients").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({ ...payload, org_id: profile.org_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getClientSessionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select(
        `id, created_at, status, payment_method, payment_amount,
         service:service_id(name),
         frequency:recommended_frequency_id(hz, label)`,
      )
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Reports ----------

export const getReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: sessions, error } = await context.supabase
      .from("sessions")
      .select(
        "id, created_at, status, payment_method, payment_amount, recommended_frequency_id, frequency:recommended_frequency_id(hz, label)",
      )
      .gte("created_at", data.from)
      .lte("created_at", data.to);
    if (error) throw new Error(error.message);

    const rows = sessions ?? [];
    const byWeek = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const revenueByMethod = new Map<string, number>();
    const unpaidCount = rows.filter(
      (r) => r.status === "completed" && (!r.payment_method || r.payment_method === "none"),
    ).length;
    const freqCounts = new Map<string, { hz: number; label: string; count: number }>();

    for (const r of rows) {
      const d = new Date(r.created_at as string);
      // ISO week key: yyyy-Www (simple, not strictly ISO)
      const y = d.getUTCFullYear();
      const firstJan = new Date(Date.UTC(y, 0, 1));
      const week = Math.ceil(
        ((d.getTime() - firstJan.getTime()) / 86400000 + firstJan.getUTCDay() + 1) / 7,
      );
      const wk = `${y}-W${String(week).padStart(2, "0")}`;
      const mo = `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
      byMonth.set(mo, (byMonth.get(mo) ?? 0) + 1);
      if (r.status === "completed" && r.payment_amount) {
        const m = r.payment_method ?? "none";
        revenueByMethod.set(m, (revenueByMethod.get(m) ?? 0) + Number(r.payment_amount));
      }
      if (r.recommended_frequency_id) {
        const f = r.frequency as { hz: number; label: string } | null;
        const key = r.recommended_frequency_id as string;
        const cur = freqCounts.get(key) ?? { hz: f?.hz ?? 0, label: f?.label ?? "", count: 0 };
        cur.count += 1;
        freqCounts.set(key, cur);
      }
    }

    return {
      totalSessions: rows.length,
      unpaidCompleted: unpaidCount,
      byWeek: [...byWeek.entries()].sort().map(([k, v]) => ({ key: k, count: v })),
      byMonth: [...byMonth.entries()].sort().map(([k, v]) => ({ key: k, count: v })),
      revenueByMethod: [...revenueByMethod.entries()].map(([method, amount]) => ({
        method,
        amount,
      })),
      topFrequencies: [...freqCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    };
  });

// ---------- Org settings ----------

export const updateOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(160).optional(),
        brand_color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        logo_path: z.string().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("No organisation");
    const patch: {
      name?: string;
      brand_color?: string | null;
      logo_path?: string | null;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.brand_color !== undefined) patch.brand_color = data.brand_color;
    if (data.logo_path !== undefined) patch.logo_path = data.logo_path;
    const { error } = await context.supabase
      .from("organisations")
      .update(patch)
      .eq("id", profile.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignedLogoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("org-logos")
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
