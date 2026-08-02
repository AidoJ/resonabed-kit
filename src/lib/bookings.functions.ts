import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPractitionerAction } from "@/lib/practitioner-permissions";
import { screeningErrorMessage } from "@/lib/screening-errors";

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
        `id, starts_at, ends_at, status, notes, practitioner_id, session_id, source, public_note,
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
    const practIds = Array.from(
      new Set((rows ?? []).map((r) => r.practitioner_id).filter((id): id is string => !!id)),
    );
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
      practitioner: r.practitioner_id ? (practById[r.practitioner_id] ?? null) : null,
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
        `id, org_id, starts_at, ends_at, status, notes, practitioner_id, session_id, client_id, service_id, source, public_note,
         client:client_id(id, first_name, last_name, email, phone),
         service:service_id(id, name, duration_minutes, buffer_minutes, price),
         session:session_id(id, status, payment_method, payment_amount, created_at)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Booking not found");
    const prof = row.practitioner_id
      ? (
          await context.supabase
            .from("profiles")
            .select("id, display_name")
            .eq("id", row.practitioner_id)
            .maybeSingle()
        ).data
      : null;
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

async function isAdminForOrg(
  context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string },
  orgId: string,
): Promise<boolean> {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", context.userId);
  const list = roles ?? [];
  return (
    list.some((r) => r.role === "super_admin") ||
    list.some((r) => r.role === "org_admin" && r.org_id === orgId)
  );
}

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

    // A practitioner (not super_admin, not org_admin of this org) may only
    // create bookings assigned to themselves, enforced here regardless of
    // what the UI submitted.
    if (
      !(await isAdminForOrg(context, profile.org_id)) &&
      data.practitioner_id !== context.userId
    ) {
      throw new Error("Practitioners can only create bookings assigned to themselves.");
    }

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

    // Practitioners can only manage bookings assigned to themselves and cannot
    // reassign a booking to another practitioner.
    if (!(await isAdminForOrg(context, existing.org_id))) {
      const { data: full } = await context.supabase
        .from("bookings")
        .select("practitioner_id")
        .eq("id", data.id)
        .maybeSingle();
      if (full?.practitioner_id && full.practitioner_id !== context.userId) {
        throw new Error("Practitioners can only edit their own bookings.");
      }
      if (data.patch.practitioner_id && data.patch.practitioner_id !== context.userId) {
        throw new Error("Practitioners cannot reassign a booking to another practitioner.");
      }
    }

    const { error } = await context.supabase.from("bookings").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid, status: z.enum(BOOKING_STATUS) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id, status");
    if (error) {
      const friendly = screeningErrorMessage(error.message);
      // Expected, user-actionable rejections (e.g. the screening gate) are
      // returned rather than thrown so the UI can show a toast instead of
      // tripping the app-level error boundary.
      return { ok: false as const, error: friendly ?? error.message };
    }
    // A silent no-op (RLS filtered the row, or it no longer exists) must not
    // look like success, the status bar would simply snap back.
    if (!updated || updated.length === 0) {
      return {
        ok: false as const,
        error: "That booking couldn't be updated. Refresh the page and try again.",
      };
    }

    // A cancellation on a public request is part of that request's story, so
    // it belongs in the audit trail alongside confirm/decline.
    if (data.status === "cancelled") {
      const { data: booking } = await context.supabase
        .from("bookings")
        .select("id, org_id, client_id, source")
        .eq("id", data.id)
        .maybeSingle();
      if (booking) {
        const { writeBookingEvent, displayNameForUser } =
          await import("@/lib/booking-safety.server");
        await writeBookingEvent(context.supabase, {
          orgId: booking.org_id,
          bookingId: booking.id,
          clientId: booking.client_id,
          eventType: "cancelled",
          actorUserId: context.userId,
          actorName: await displayNameForUser(context.supabase, context.userId),
        });
      }
    }
    return { ok: true as const };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing, error: exErr } = await context.supabase
      .from("bookings")
      .select("org_id")
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing?.org_id) throw new Error("Booking not found");
    await assertPractitionerAction(context, existing.org_id, "manage_bookings");
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
  screening_id: uuid,
  pain_level: z.number().int().min(0).max(10),
  stress_level: z.number().int().min(0).max(10),
  sleep_quality: z.number().int().min(0).max(10),
  body_areas: z.array(z.string()).max(20),
  primary_goals: z.array(z.string()).max(20),
  health_concerns: z.array(z.string()).max(20).default([]),
  contraindications: z.array(z.string()).max(20),
  practitioner_notes: z.string().max(4000).optional(),
  consent_given: z.literal(true),
  client_signature: z.string().max(2_000_000).optional(),
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

    const { pseudonymForClient } = await import("@/lib/pseudonym.server");
    const { data: session, error: sErr } = await context.supabase
      .from("sessions")
      .insert({
        org_id: booking.org_id,
        practitioner_id: booking.practitioner_id ?? context.userId,
        client_id: booking.client_id,
        pseudonym_id: await pseudonymForClient(context.supabase, booking.client_id),
        service_id: booking.service_id,
        screening_id: data.screening_id,
        pain_level: data.pain_level,
        stress_level: data.stress_level,
        sleep_quality: data.sleep_quality,
        body_areas: data.body_areas,
        primary_goals: data.primary_goals,
        health_concerns: data.health_concerns,
        contraindications: data.contraindications,
        practitioner_notes: data.practitioner_notes ?? null,
        consent_given: data.consent_given,
        client_signature: data.client_signature ?? null,
        signed_at: data.client_signature ? new Date().toISOString() : null,
        recommended_frequency_id: data.recommended_frequency_id,
        status: "draft",
      })
      .select("id")
      .single();
    if (sErr) {
      const friendly = screeningErrorMessage(sErr.message);
      throw new Error(friendly ?? sErr.message);
    }

    const { error: linkErr } = await context.supabase
      .from("bookings")
      .update({ session_id: session.id, status: "in_progress" })
      .eq("id", booking.id);
    if (linkErr) throw new Error(linkErr.message);

    return { session_id: session.id };
  });

// ---------- Public booking requests ----------

/**
 * Everything the operator needs to vet a public request before confirming.
 * Confirming a request discloses the clinic address to this person, so the
 * confirm screen shows who they are and (for home-based clinics) says so.
 */
export const getPublicRequestDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bookings")
      .select(
        `id, org_id, client_id, starts_at, ends_at, status, source, public_note,
         client:client_id(first_name, last_name, email, phone),
         service:service_id(name, duration_minutes)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Booking not found");

    const { data: org } = await context.supabase
      .from("organisations")
      .select("clinic_type, public_suburb")
      .eq("id", row.org_id)
      .maybeSingle();

    // First-time vs returning: matched on normalised phone OR email across
    // every client row in this org, then judged on prior activity rather
    // than on the mere existence of a client record (the public flow creates
    // one on the very first request).
    const client = row.client as unknown as {
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
    } | null;

    const { findMatchingClientIds, isReturningPerson } =
      await import("@/lib/booking-safety.server");
    const matchedIds = new Set(
      await findMatchingClientIds(context.supabase, {
        orgId: row.org_id,
        email: client?.email,
        phone: client?.phone,
      }),
    );
    if (row.client_id) matchedIds.add(row.client_id);

    const returning = await isReturningPerson(context.supabase, {
      orgId: row.org_id,
      clientIds: Array.from(matchedIds),
      excludeBookingId: row.id,
    });

    return {
      ...row,
      clinic_type: ((org?.clinic_type as string) ?? "home") as "retail" | "home",
      public_suburb: (org?.public_suburb as string | null) ?? null,
      is_first_time: !returning,
    };
  });

/**
 * Confirm or decline a booking that arrived through the public page.
 * Confirming requires assigning a practitioner; declining cancels it.
 *
 * ADDRESS DISCLOSURE: confirming is the single point at which the clinic's
 * full street address is released to the client, via the confirmation email.
 * Nothing in the pending path carries it.
 */
export const respondToPublicRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid,
        action: z.enum(["confirm", "decline"]),
        practitioner_id: uuid.optional(),
        // Reason CODES only, never free-text health detail. Specifics belong
        // in the protected client notes, not in the audit trail.
        reason_code: z
          .enum([
            "health_item_clearance_advised",
            "not_suitable_at_this_time",
            "unable_to_accommodate",
            "other",
          ])
          .optional(),
        notify_client: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select(
        `id, org_id, status, source, practitioner_id, starts_at, client_id,
         client:client_id(first_name, last_name, email),
         service:service_id(name)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found");
    if (booking.source !== "public" || booking.status !== "pending") {
      throw new Error("This booking is not a pending public request");
    }

    const clientRow = booking.client as unknown as {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;

    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    const operatorName = await displayNameForUser(context.supabase, context.userId);

    if (data.action === "decline") {
      const { error: dErr } = await context.supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", data.id);
      if (dErr) throw new Error(dErr.message);

      await writeBookingEvent(context.supabase, {
        orgId: booking.org_id,
        bookingId: booking.id,
        clientId: booking.client_id,
        eventType: "declined",
        reasonCode: data.reason_code ?? "unable_to_accommodate",
        actorUserId: context.userId,
        actorName: operatorName,
        requesterName: clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : null,
        requesterEmail: clientRow?.email ?? null,
        detail: { notified: data.notify_client === true },
      });

      // Neutral notification only, and only if the operator asked for it.
      // No address, no service, no time, no reason.
      let emailed = false;
      if (data.notify_client && clientRow?.email) {
        try {
          const { data: org } = await context.supabase
            .from("organisations")
            .select("name")
            .eq("id", booking.org_id)
            .maybeSingle();
          const { formatPersonName } = await import("@/lib/person-name");
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const res = await sendTemplateEmail("booking-declined", clientRow.email, {
            templateData: {
              orgName: org?.name ?? "the clinic",
              clientName: formatPersonName(clientRow.first_name),
            },
            // No reply-to: a decline must not invite the declined person to
            // open a channel back to the operator.
            idempotencyKey: `booking-declined-${data.id}`,
          });
          emailed = res.sent;
        } catch (err) {
          console.error("decline notification failed", err);
        }
      }

      return { ok: true as const, emailed };
    }

    if (!data.practitioner_id) {
      throw new Error("Assign a practitioner before confirming");
    }

    const { confirmBookingAndNotify } = await import("@/lib/booking-confirm.server");
    const res = await confirmBookingAndNotify(context.supabase, {
      bookingId: booking.id,
      practitionerId: data.practitioner_id,
      actorUserId: context.userId,
      actorName: operatorName,
    });
    if (!res.ok) throw new Error(res.error ?? "Could not confirm this booking.");

    return { ok: true as const, emailed: res.emailed };
  });

/**
 * Move a CONFIRMED booking to a new time and tell the client.
 *
 * Editing a booking in the form dialog changes the record silently, which is
 * fine for internal tidy-ups but wrong when a real appointment moves. This is
 * the deliberate, client-notifying path: same confirmation email, new time,
 * and an audit-trail entry.
 */
export const rescheduleBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        booking_id: uuid,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        notify: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings")
      .select(
        "id, org_id, status, practitioner_id, starts_at, ends_at, service:service_id(duration_minutes)",
      )
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking) return { ok: false as const, error: "Booking not found" };
    await assertPractitionerAction(context, booking.org_id, "manage_bookings");
    if (booking.status !== "confirmed") {
      return { ok: false as const, error: "Only a confirmed booking can be rescheduled." };
    }
    if (!booking.practitioner_id) {
      return { ok: false as const, error: "Assign a practitioner before rescheduling." };
    }

    const { data: org } = await context.supabase
      .from("organisations")
      .select("timezone")
      .eq("id", booking.org_id)
      .maybeSingle();

    const { DEFAULT_TIMEZONE, zonedWallTimeToUtc } = await import("@/lib/timezone");
    const tz = org?.timezone || DEFAULT_TIMEZONE;
    const startsAt = zonedWallTimeToUtc(data.date, data.time, tz);
    if (startsAt.getTime() < Date.now()) {
      return { ok: false as const, error: "Pick a time in the future." };
    }
    const duration =
      (booking.service as unknown as { duration_minutes?: number } | null)?.duration_minutes ??
      Math.max(
        30,
        Math.round(
          (new Date(booking.ends_at as string).getTime() -
            new Date(booking.starts_at as string).getTime()) /
            60000,
        ),
      );
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    const { confirmBookingAndNotify } = await import("@/lib/booking-confirm.server");
    const { displayNameForUser } = await import("@/lib/booking-safety.server");

    if (!data.notify) {
      const { error } = await context.supabase
        .from("bookings")
        .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
        .eq("id", booking.id);
      if (error) return { ok: false as const, error: error.message };
      const { writeBookingEvent } = await import("@/lib/booking-safety.server");
      await writeBookingEvent(context.supabase, {
        orgId: booking.org_id,
        bookingId: booking.id,
        eventType: "rescheduled",
        actorUserId: context.userId,
        actorName: await displayNameForUser(context.supabase, context.userId),
        detail: { starts_at: startsAt.toISOString(), notified: false },
      });
      return { ok: true as const, emailed: false };
    }

    const res = await confirmBookingAndNotify(context.supabase, {
      bookingId: booking.id,
      practitionerId: booking.practitioner_id as string,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
      eventType: "rescheduled",
      rescheduled: true,
      detail: { previous_starts_at: booking.starts_at },
    });
    return res.ok
      ? { ok: true as const, emailed: res.emailed }
      : { ok: false as const, error: res.error ?? "Couldn't move that booking." };
  });
