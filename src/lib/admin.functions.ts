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
      .select("id, name, duration_minutes, buffer_minutes, price, is_active, created_at")
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
        buffer_minutes: z.number().int().min(0).max(240),
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
          buffer_minutes: data.buffer_minutes,
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
        buffer_minutes: data.buffer_minutes,
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
          .select("id, display_name, is_active, org_id, email_status")
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
      email_status: (p as { email_status?: string }).email_status ?? "valid",
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
      .select("id, first_name, last_name, email, phone, date_of_birth, email_status, created_at")
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
         frequency:recommended_frequency_id(hz, name)`,
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
        "id, created_at, status, payment_method, payment_amount, recommended_frequency_id, frequency:recommended_frequency_id(hz, name)",
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
        const f = r.frequency as { hz: number; name: string } | null;
        const key = r.recommended_frequency_id as string;
        const cur = freqCounts.get(key) ?? { hz: f?.hz ?? 0, label: f?.name ?? "", count: 0 };
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

const POLICY_FIELDS = ["consent_text", "privacy_policy_text", "health_policy_text"] as const;

export const getOrgSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("No organisation");
    const { data, error } = await context.supabase
      .from("organisations")
      .select(
        "id, name, business_name, contact_email, abn, brand_color, logo_path, theme_primary, theme_sidebar, theme_accent, consent_text, consent_version, privacy_policy_text, health_policy_text, is_configured, configured_at, configured_acknowledgement_by, configured_acknowledgement_at",
      )
      .eq("id", profile.org_id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const listPolicyAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("org_policy_audit")
      .select("id, field, old_value, new_value, edited_by, edited_by_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(160).optional(),
        business_name: z.string().min(1).max(160).nullable().optional(),
        contact_email: z.string().email().max(200).nullable().optional(),
        abn: z.string().max(60).nullable().optional(),
        brand_color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        theme_primary: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        theme_sidebar: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        theme_accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        logo_path: z.string().max(400).nullable().optional(),
        consent_text: z.string().max(20000).nullable().optional(),
        privacy_policy_text: z.string().max(40000).nullable().optional(),
        health_policy_text: z.string().max(40000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("org_id, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("No organisation");

    const { data: existing, error: exErr } = await context.supabase
      .from("organisations")
      .select("consent_text, consent_version, privacy_policy_text, health_policy_text")
      .eq("id", profile.org_id)
      .single();
    if (exErr) throw new Error(exErr.message);

    const patch: Record<string, unknown> = {};
    const auditRows: Array<{
      org_id: string;
      field: string;
      old_value: string | null;
      new_value: string | null;
      edited_by: string;
      edited_by_name: string | null;
    }> = [];

    for (const key of [
      "name",
      "business_name",
      "contact_email",
      "abn",
      "brand_color",
      "theme_primary",
      "theme_sidebar",
      "theme_accent",
      "logo_path",
    ] as const) {
      const v = data[key];
      if (v !== undefined) patch[key] = v;
    }

    for (const field of POLICY_FIELDS) {
      const v = data[field];
      const oldVal = (existing as unknown as Record<string, string | null>)[field] ?? null;
      if (v !== undefined && v !== oldVal) {
        patch[field] = v;
        auditRows.push({
          org_id: profile.org_id,
          field,
          old_value: oldVal,
          new_value: v,
          edited_by: context.userId,
          edited_by_name: profile.display_name ?? null,
        });
      }
    }

    // Bump consent_version when consent_text changes.
    if (patch.consent_text !== undefined) {
      patch.consent_version = (existing.consent_version ?? 1) + 1;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await context.supabase
        .from("organisations")
        .update(patch as never)
        .eq("id", profile.org_id);
      if (error) throw new Error(error.message);
    }
    if (auditRows.length > 0) {
      const { error: aErr } = await context.supabase.from("org_policy_audit").insert(auditRows);
      if (aErr) throw new Error(aErr.message);
    }
    return { ok: true };
  });

export const completeOrgSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        acknowledger_name: z.string().min(2).max(200),
        acknowledged: z.literal(true),
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

    const { data: org, error: oErr } = await context.supabase
      .from("organisations")
      .select(
        "business_name, contact_email, logo_path, consent_text, privacy_policy_text, health_policy_text, is_configured",
      )
      .eq("id", profile.org_id)
      .single();
    if (oErr) throw new Error(oErr.message);

    if (org.is_configured) {
      throw new Error("Organisation is already live. The acknowledgement is immutable.");
    }

    const missing: string[] = [];
    if (!org.business_name?.trim()) missing.push("business name");
    if (!org.contact_email?.trim()) missing.push("contact email");
    if (!org.logo_path?.trim()) missing.push("logo");
    if (!org.consent_text?.trim()) missing.push("consent wording");
    if (!org.privacy_policy_text?.trim()) missing.push("privacy policy");
    if (!org.health_policy_text?.trim()) missing.push("health & safety policy");
    if (missing.length > 0) {
      throw new Error(`Complete these before go-live: ${missing.join(", ")}.`);
    }

    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("organisations")
      .update({
        is_configured: true,
        configured_at: now,
        configured_acknowledgement_by: data.acknowledger_name.trim(),
        configured_acknowledgement_at: now,
      })
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
