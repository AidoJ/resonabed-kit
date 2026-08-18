import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveEffectiveOrgId } from "@/lib/org-context";

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

// ---------- Services CRUD (org-scoped only, global catalogue lives elsewhere) ----------

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await resolveEffectiveOrgId(context);
    let q = context.supabase
      .from("services")
      .select(
        "id, name, duration_minutes, buffer_minutes, price, show_price, is_active, created_at, source_global_id, sort_order, description, image_path",
      )
      .not("org_id", "is", null)
      .order("sort_order")
      .order("name");
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // Live RRP guide plus the locked description/picture from the global
    // catalogue (never snapshotted, never editable by the clinic).
    const globalIds = [...new Set(rows.map((r) => r.source_global_id).filter(Boolean))] as string[];
    const globalById = new Map<
      string,
      { rrp: number | null; description: string | null; image_path: string | null }
    >();
    if (globalIds.length > 0) {
      const { data: globals } = await context.supabase
        .from("services")
        .select("id, rrp, description, image_path")
        .in("id", globalIds)
        .is("org_id", null);
      for (const g of globals ?? [])
        globalById.set(g.id, {
          rrp: g.rrp as number | null,
          description: (g.description as string | null) ?? null,
          image_path: (g.image_path as string | null) ?? null,
        });
    }

    const withGlobal = rows.map((r) => {
      const g = r.source_global_id ? globalById.get(r.source_global_id) : undefined;
      return {
        ...r,
        rrp: g?.rrp ?? null,
        /** Standard sessions display the platform copy, not their own. */
        description: g ? (g.description ?? null) : ((r.description as string | null) ?? null),
        image_path: g ? (g.image_path ?? null) : ((r.image_path as string | null) ?? null),
        is_standard: !!r.source_global_id,
      };
    });

    const paths = withGlobal.map((r) => r.image_path).filter((p): p is string => !!p);
    const urlByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await context.supabase.storage
        .from("service-images")
        .createSignedUrls([...new Set(paths)], 3600);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
      }
    }
    return withGlobal.map((r) => ({
      ...r,
      image_url: r.image_path ? (urlByPath.get(r.image_path) ?? null) : null,
    }));
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
        show_price: z.boolean().default(true),
        is_active: z.boolean(),
        description: z.string().max(2000).nullable().optional(),
        image_path: z.string().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { orgId: _org_id } = await resolveEffectiveOrgId(context);
    if (!_org_id) throw new Error("No organisation");
    if (data.id) {
      // Standard vibroacoustic sessions are platform-owned: the clinic may set
      // pricing/visibility/turnaround only, never the wording or the picture.
      const { data: existing, error: exErr } = await context.supabase
        .from("services")
        .select("source_global_id")
        .eq("id", data.id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      const isStandard = !!existing?.source_global_id;
      const patch: Record<string, unknown> = {
        duration_minutes: data.duration_minutes,
        buffer_minutes: data.buffer_minutes,
        price: data.price,
        show_price: data.show_price,
        is_active: data.is_active,
      };
      if (!isStandard) {
        patch.name = data.name;
        patch.duration_minutes = data.duration_minutes;
        if (data.description !== undefined) patch.description = data.description;
        if (data.image_path !== undefined) patch.image_path = data.image_path;
      } else {
        delete patch.duration_minutes;
      }
      const { error } = await context.supabase.from("services").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("services")
      .insert({
        org_id: _org_id,
        name: data.name,
        duration_minutes: data.duration_minutes,
        buffer_minutes: data.buffer_minutes,
        price: data.price,
        show_price: data.show_price,
        is_active: data.is_active,
        description: data.description ?? null,
        image_path: data.image_path ?? null,
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

export const reorderServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(uuid).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { orgId } = await resolveEffectiveOrgId(context);
    if (!orgId) throw new Error("No organisation");
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("services")
        .update({ sort_order: i + 1 })
        .eq("id", data.ids[i])
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


// ---------- Team list ----------

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { orgId } = await resolveEffectiveOrgId(context);
    let profilesQ = context.supabase
      .from("profiles")
      .select("id, display_name, is_active, org_id, email_status, bio, avatar_path")
      .order("display_name");
    if (orgId) profilesQ = profilesQ.eq("org_id", orgId);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      profilesQ,
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

    // Signed URLs for headshots (private bucket).
    const rows = profiles ?? [];
    const avatarPaths = rows
      .map((p) => (p as { avatar_path?: string | null }).avatar_path)
      .filter((p): p is string => !!p);
    const avatarUrlByPath = new Map<string, string>();
    if (avatarPaths.length > 0) {
      const { data: signed } = await context.supabase.storage
        .from("team-avatars")
        .createSignedUrls(avatarPaths, 3600);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) avatarUrlByPath.set(s.path, s.signedUrl);
      }
    }

    return rows.map((p) => {
      const avatarPath = (p as { avatar_path?: string | null }).avatar_path ?? null;
      return {
        id: p.id,
        display_name: p.display_name,
        is_active: p.is_active,
        org_id: p.org_id,
        email_status: (p as { email_status?: string }).email_status ?? "valid",
        bio: (p as { bio?: string | null }).bio ?? null,
        avatar_path: avatarPath,
        avatar_url: avatarPath ? (avatarUrlByPath.get(avatarPath) ?? null) : null,
        roles: rolesByUser.get(p.id) ?? [],
      };
    });
  });

export const updateTeamMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: uuid,
        bio: z.string().max(2000).nullable().optional(),
        avatar_path: z.string().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const patch: { bio?: string | null; avatar_path?: string | null } = {};
    if (data.bio !== undefined) patch.bio = data.bio?.trim() ? data.bio.trim() : null;
    if (data.avatar_path !== undefined) patch.avatar_path = data.avatar_path;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Clients (admin + permitted practitioners) ----------

async function assertCanViewClients(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { orgId } = await resolveEffectiveOrgId(context);
  if (!orgId) {
    const { isSuper } = await requireAdmin(context);
    if (isSuper) return { orgId: null as string | null };
    throw new Error("No organisation");
  }
  const { assertPractitionerAction } = await import("@/lib/practitioner-permissions");
  await assertPractitionerAction(context, orgId, "view_all_clients");
  return { orgId };
}

async function assertCanManageClients(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { orgId } = await resolveEffectiveOrgId(context);
  if (!orgId) throw new Error("No organisation");
  const { assertPractitionerAction } = await import("@/lib/practitioner-permissions");
  await assertPractitionerAction(context, orgId, "manage_clients");
  return { orgId };
}

export const listClientsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { orgId } = await assertCanViewClients(context);
    let q = context.supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, date_of_birth, email_status, created_at")
      .order("last_name");
    if (orgId) q = q.eq("org_id", orgId);
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
    const { orgId: _org_id } = await assertCanManageClients(context);
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
    const { createPseudonym } = await import("@/lib/pseudonym.server");
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({
        ...payload,
        org_id: _org_id,
        pseudonym_id: await createPseudonym(context.supabase, _org_id),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getClientSessionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanViewClients(context);
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
    const { orgId } = await resolveEffectiveOrgId(context);
    let q = context.supabase
      .from("sessions")
      .select(
        "id, created_at, status, payment_method, payment_amount, recommended_frequency_id, frequency:recommended_frequency_id(hz, name)",
      )
      .gte("created_at", data.from)
      .lte("created_at", data.to);
    if (orgId) q = q.eq("org_id", orgId);
    const { data: sessions, error } = await q;
    if (error) throw new Error(error.message);

    const rows = sessions ?? [];
    const byWeek = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const revenueByMethod = new Map<string, number>();
    const unpaidCount = rows.filter(
      (r) =>
        r.status === "completed" &&
        (!r.payment_method || r.payment_method === "none" || r.payment_method === "unpaid"),
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
    const { orgId: _org_id } = await resolveEffectiveOrgId(context);
    if (!_org_id) return null;
    const { data, error } = await context.supabase
      .from("organisations")
      .select(
        "id, name, business_name, contact_email, abn, brand_color, logo_path, theme_primary, theme_sidebar, theme_accent, consent_text, consent_version, privacy_policy_text, health_policy_text, is_configured, configured_at, configured_acknowledgement_by, configured_acknowledgement_at, configured_acknowledgement_signature, practitioners_can_manage_clients, practitioners_can_view_all_clients, practitioners_can_manage_bookings, practitioners_can_complete_unpaid, slug, published, public_blurb, public_strapline, public_contact_email, public_contact_phone, public_show_email, public_show_phone, public_show_practitioners, public_allow_practitioner_choice, public_suburb, public_booking_enabled, timezone, clinic_type, clinic_type_confirmed, retail_show_address, address_line1, address_line2, address_city, address_state, address_postcode, address_country",
      )

      .eq("id", _org_id)
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
        practitioners_can_manage_clients: z.boolean().optional(),
        practitioners_can_view_all_clients: z.boolean().optional(),
        practitioners_can_manage_bookings: z.boolean().optional(),
        practitioners_can_complete_unpaid: z.boolean().optional(),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only")
          .min(3)
          .max(48)
          .nullable()
          .optional(),
        published: z.boolean().optional(),
        public_blurb: z.string().max(4000).nullable().optional(),
        public_strapline: z.string().max(50).nullable().optional(),
        public_contact_email: z.string().email().max(200).nullable().optional(),
        public_contact_phone: z.string().max(60).nullable().optional(),
        public_show_email: z.boolean().optional(),
        public_show_phone: z.boolean().optional(),
        public_show_practitioners: z.boolean().optional(),
        public_allow_practitioner_choice: z.boolean().optional(),
        public_suburb: z.string().max(120).nullable().optional(),
        public_booking_enabled: z.boolean().optional(),
        timezone: z.string().min(1).max(64).optional(),
        clinic_type: z.enum(["retail", "home"]).optional(),
        clinic_type_confirmed: z.boolean().optional(),
        retail_show_address: z.boolean().optional(),
        address_line1: z.string().max(200).nullable().optional(),
        address_line2: z.string().max(200).nullable().optional(),
        address_city: z.string().max(120).nullable().optional(),
        address_state: z.string().max(60).nullable().optional(),
        address_postcode: z.string().max(20).nullable().optional(),
        address_country: z.string().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { orgId } = await resolveEffectiveOrgId(context);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const _org_id = orgId;
    if (!_org_id) throw new Error("No organisation");

    const { data: existing, error: exErr } = await context.supabase
      .from("organisations")
      .select("consent_text, consent_version, privacy_policy_text, health_policy_text")
      .eq("id", _org_id)
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
      "practitioners_can_manage_clients",
      "practitioners_can_view_all_clients",
      "practitioners_can_manage_bookings",
      "practitioners_can_complete_unpaid",
      "slug",
      "published",
      "public_blurb",
      "public_strapline",
      "public_contact_email",
      "public_contact_phone",
      "public_show_email",
      "public_show_phone",
      "public_show_practitioners",
      "public_allow_practitioner_choice",
      "public_suburb",
      "public_booking_enabled",
      "timezone",
      "clinic_type",
      "clinic_type_confirmed",
      "retail_show_address",
      "address_line1",
      "address_line2",
      "address_city",
      "address_state",
      "address_postcode",
      "address_country",
    ] as const) {
      const v = data[key];
      if (v !== undefined) patch[key] = v;
    }

    // Address privacy is derived from clinic_type, never from a free toggle.
    // A home-based clinic can never publish its street address; the only way
    // to make an address public is to deliberately change clinic_type.
    if (patch.clinic_type !== undefined || patch.retail_show_address !== undefined) {
      const { data: current } = await context.supabase
        .from("organisations")
        .select("clinic_type")
        .eq("id", _org_id)
        .maybeSingle();
      const effectiveType = (patch.clinic_type as string) ?? current?.clinic_type ?? "home";
      if (effectiveType === "home") patch.retail_show_address = false;
      if (patch.clinic_type !== undefined) patch.clinic_type_confirmed = true;
    }

    for (const field of POLICY_FIELDS) {
      const v = data[field];
      const oldVal = (existing as unknown as Record<string, string | null>)[field] ?? null;
      if (v !== undefined && v !== oldVal) {
        patch[field] = v;
        auditRows.push({
          org_id: _org_id,
          field,
          old_value: oldVal,
          new_value: v,
          edited_by: context.userId,
          edited_by_name: profile?.display_name ?? null,
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
        .eq("id", _org_id);
      if (error) {
        if (error.code === "23505" || /organisations_slug_key/.test(error.message)) {
          throw new Error("That public URL name is already taken. Try another.");
        }
        throw new Error(error.message);
      }
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
        signature: z
          .string()
          .min(100)
          .max(2_000_000)
          .regex(/^data:image\/png;base64,/, "Signature must be a PNG image"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { orgId: _org_id } = await resolveEffectiveOrgId(context);
    if (!_org_id) throw new Error("No organisation");

    const { data: org, error: oErr } = await context.supabase
      .from("organisations")
      .select(
        "business_name, contact_email, logo_path, consent_text, privacy_policy_text, health_policy_text, is_configured",
      )
      .eq("id", _org_id)
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
        configured_acknowledgement_signature: data.signature,
      })
      .eq("id", _org_id);
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
