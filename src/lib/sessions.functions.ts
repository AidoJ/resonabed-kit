import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Clients ----------

export const listMyOrgClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string }) =>
    z.object({ search: z.string().max(120).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone")
      .order("last_name", { ascending: true })
      .limit(50);
    if (data.search && data.search.trim().length > 0) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createClientRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        first_name: z.string().min(1).max(80),
        last_name: z.string().min(1).max(80),
        email: z.string().email().max(160).optional().or(z.literal("").transform(() => undefined)),
        phone: z.string().max(40).optional().or(z.literal("").transform(() => undefined)),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) throw new Error("No organisation assigned to your profile");
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({
        org_id: profile.org_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? null,
        phone: data.phone ?? null,
      })
      .select("id, first_name, last_name, email, phone")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Services & frequencies ----------

export const listMyOrgServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, duration_minutes, buffer_minutes, price, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const FREQ_COLUMNS =
  "id, hz, name, description, benefits, color, goal_tags, body_area_tags";

export const listFrequencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("frequencies")
      .select(FREQ_COLUMNS)
      .order("hz", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Frequencies plus a flag indicating whether the caller's org has an active
// audio file for each. Used to bias the recommendation UI.
export const listFrequenciesWithAudioFlag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [freqRes, audioRes] = await Promise.all([
      context.supabase.from("frequencies").select(FREQ_COLUMNS).order("hz", { ascending: true }),
      context.supabase.from("audio_files").select("frequency_id").eq("is_active", true),
    ]);
    if (freqRes.error) throw new Error(freqRes.error.message);
    if (audioRes.error) throw new Error(audioRes.error.message);
    const withAudio = new Set(
      (audioRes.data ?? []).map((r) => r.frequency_id).filter((v): v is string => !!v),
    );
    return (freqRes.data ?? []).map((f) => ({ ...f, has_audio: withAudio.has(f.id) }));
  });

// Admin: upsert a frequency. RLS restricts write access to super_admin.
const frequencyInput = z.object({
  id: uuid.optional(),
  hz: z.number().int().min(1).max(20000),
  name: z.string().min(1).max(80),
  description: z.string().max(1000).nullable().optional(),
  benefits: z.string().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  goal_tags: z.array(z.string().max(40)).max(20),
  body_area_tags: z.array(z.string().max(40)).max(20),
});

export const upsertFrequency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => frequencyInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      hz: data.hz,
      name: data.name,
      description: data.description ?? null,
      benefits: data.benefits ?? null,
      color: data.color ?? null,
      goal_tags: data.goal_tags,
      body_area_tags: data.body_area_tags,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("frequencies")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("frequencies")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFrequency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("frequencies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Sessions ----------

const createDraftInput = z.object({
  client_id: uuid,
  service_id: uuid,
  pain_level: z.number().int().min(0).max(10),
  stress_level: z.number().int().min(0).max(10),
  sleep_quality: z.number().int().min(0).max(10),
  body_areas: z.array(z.string()).max(20),
  primary_goals: z.array(z.string()).max(20),
  health_concerns: z.array(z.string()).max(20).default([]),
  contraindications: z.array(z.string()).max(20),
  practitioner_notes: z.string().max(4000).optional(),
  consent_given: z.literal(true),
  recommended_frequency_id: uuid.nullable(),
});

export const createDraftSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createDraftInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) throw new Error("No organisation assigned to your profile");

    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({
        org_id: profile.org_id,
        practitioner_id: context.userId,
        client_id: data.client_id,
        service_id: data.service_id,
        pain_level: data.pain_level,
        stress_level: data.stress_level,
        sleep_quality: data.sleep_quality,
        body_areas: data.body_areas,
        primary_goals: data.primary_goals,
        health_concerns: data.health_concerns,
        contraindications: data.contraindications,
        practitioner_notes: data.practitioner_notes ?? null,
        consent_given: data.consent_given,
        recommended_frequency_id: data.recommended_frequency_id,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sessions")
      .select(
        `id, status, pain_level, stress_level, sleep_quality, body_areas, primary_goals,
         contraindications, practitioner_notes, payment_method, payment_amount,
         recommended_frequency_id, service_id, client_id, org_id, created_at,
         client:client_id(id, first_name, last_name, email, phone),
         service:service_id(id, name, duration_minutes, price),
         frequency:recommended_frequency_id(id, hz, name, description, benefits, color)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Session not found");
    return row;
  });

export const updateSessionFrequency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, recommended_frequency_id: uuid.nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({ recommended_frequency_id: data.recommended_frequency_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid,
        payment_method: z.enum(["cash", "eftpos", "payid", "other", "none"]),
        payment_amount: z.number().min(0).max(100000).nullable(),
        practitioner_notes: z.string().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({
        status: "completed",
        payment_method: data.payment_method,
        payment_amount: data.payment_amount,
        practitioner_notes: data.practitioner_notes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyOrgSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select(
        `id, status, created_at, payment_method, payment_amount,
         client:client_id(id, first_name, last_name),
         service:service_id(id, name),
         frequency:recommended_frequency_id(id, hz, name, color)`,
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Audio ----------

export const getAudioForFrequency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { frequency_id: string }) =>
    z.object({ frequency_id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // If multiple active audio files exist for the frequency, use the most
    // recently created one.
    const { data: rows, error } = await context.supabase
      .from("audio_files")
      .select("id, title, file_url, duration_seconds, created_at")
      .eq("frequency_id", data.frequency_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const getSignedAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audio_file_id: string }) =>
    z.object({ audio_file_id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("audio_files")
      .select("file_url")
      .eq("id", data.audio_file_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.file_url) throw new Error("Audio file has no stored path");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("audio-files")
      .createSignedUrl(row.file_url, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });
