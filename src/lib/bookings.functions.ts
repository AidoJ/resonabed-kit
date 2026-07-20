import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPractitionerAction } from "@/lib/practitioner-permissions";

const uuid = z.string().uuid();

const BOOKING_STATUS = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUS)[number];

// ---------- List / detail ----------

export const listBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        practitioner_id: uuid.optional(),
        unpaid_only: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, notes, practitioner_id, session_id,
         client:client_id(id, first_name, last_name),
         service:service_id(id, name, duration_minutes, buffer_minutes, price),
         session:session_id(id, status, payment_method, payment_amount)`,
      )
      .gte("starts_at", data.from)
      .lt("starts_at", data.to)
      .order("starts_at", { ascending: true });
    if (data.practitioner_id) q = q.eq("practitioner_id", data.practitioner_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // Fetch practitioners separately (bookings.practitioner_id FKs auth.users,
    // not profiles, so we can't auto-join to profiles.display_name).
    const practIds = Array.from(new Set((rows ?? []).map((r) => r.practitioner_id)));
    const practById: Record<string, { id: string; display_name: string | null }> = {};
    if (practIds.length > 0) {
      const { data: profs, error: pErr } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", practIds);
      if (pErr) throw new Error(pErr.message);
      for (const p of profs ?? []) practById[p.id] = p;
    }
    let filtered = (rows ?? []).map((r) => ({
      ...r,
      practitioner: practById[r.practitioner_id] ?? null,
    }));
    if (data.unpaid_only) {
      filtered = filtered.filter((b) => {
        const s = (b as unknown as { session?: { status?: string; payment_method?: string } })
          .session;
        return s?.status === "completed" && s.payment_method === "none";
      });
    }
    return filtered;
  });

export const getBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bookings")
      .select(
        `id, org_id, starts_at, ends_at, status, notes, practitioner_id, session_id, client_id, service_id,
         client:client_id(id, first_name, last_name, email, phone),
         service:service_id(id, name, duration_minutes, buffer_minutes, price),
         session:session_id(id, status, payment_method, payment_amount, created_at)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Booking not found");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", row.practitioner_id)
      .maybeSingle();
    return { ...row, practitioner: prof ?? null };
  });

// ---------- Create / update / delete ----------

const bookingInput = z.object({
  client_id: uuid,
  service_id: uuid,
  practitioner_id: uuid,
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  status: z.enum(BOOKING_STATUS).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => bookingInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) throw new Error("No organisation assigned to your profile");
    await assertPractitionerAction(context, profile.org_id, "manage_bookings");
    const { data: row, error } = await context.supabase
      .from("bookings")
      .insert({
        org_id: profile.org_id,
        client_id: data.client_id,
        service_id: data.service_id,
        practitioner_id: data.practitioner_id,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        status: data.status ?? "pending",
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid,
        patch: bookingInput.partial(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Look up the booking's org to run the practitioner-permission check.
    const { data: existing, error: exErr } = await context.supabase
      .from("bookings")
      .select("org_id")
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing?.org_id) throw new Error("Booking not found");
    await assertPractitionerAction(context, existing.org_id, "manage_bookings");
    const { error } = await context.supabase
      .from("bookings")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, status: z.enum(BOOKING_STATUS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Practitioners in my org ----------

export const listOrgPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.org_id) return [];
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .eq("org_id", profile.org_id)
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Start session from a booking ----------

const startSessionInput = z.object({
  booking_id: uuid,
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

export const startSessionFromBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startSessionInput.parse(data))
  .handler(async ({ data, context }) => {
    // Load the booking (RLS-scoped) to pull org_id, client_id, service_id, practitioner_id.
    const { data: booking, error: bErr } = await context.supabase
      .from("bookings")
      .select("id, org_id, client_id, service_id, practitioner_id, session_id, status")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!booking) throw new Error("Booking not found");
    if (booking.session_id) throw new Error("Session already started for this booking");
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new Error(`Cannot start a session from a booking with status ${booking.status}`);
    }

    const { data: session, error: sErr } = await context.supabase
      .from("sessions")
      .insert({
        org_id: booking.org_id,
        practitioner_id: booking.practitioner_id,
        client_id: booking.client_id,
        service_id: booking.service_id,
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
    if (sErr) throw new Error(sErr.message);

    const { error: linkErr } = await context.supabase
      .from("bookings")
      .update({ session_id: session.id, status: "in_progress" })
      .eq("id", booking.id);
    if (linkErr) throw new Error(linkErr.message);

    return { session_id: session.id };
  });
