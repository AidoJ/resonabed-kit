/**
 * Staff-side actions for proposing alternate times.
 *
 * Everything here is behind requireSupabaseAuth; RLS scopes rows to the
 * caller's clinic.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listBookingOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ booking_id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: offers, error } = await context.supabase
      .from("booking_offers")
      .select(
        "id, status, sent_at, expires_at, reminded_at, accepted_at, accepted_slot_id, practitioner_id, slots:booking_offer_slots(id, starts_at, ends_at)",
      )
      .eq("booking_id", data.booking_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return offers ?? [];
  });

/**
 * Propose 2–3 alternate times to a client whose requested slot doesn't work.
 * The booking stays pending; nothing is held and nothing is confirmed until
 * the client picks one.
 */
export const proposeAlternates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        booking_id: uuid,
        practitioner_id: uuid,
        slots: z
          .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }))
          .min(2)
          .max(3),
        /**
         * First-time clients are handled by phone: the operator reads the
         * times out on the vetting call. No link is emailed.
         */
        verbal_only: z.boolean().default(false),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings")
      .select(
        `id, org_id, status, client_id, service_id,
         client:client_id(first_name, last_name, email),
         service:service_id(name, duration_minutes)`,
      )
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking) return { ok: false as const, error: "Booking not found" };
    if (booking.status !== "pending") {
      return { ok: false as const, error: "Only a pending request can be offered alternates." };
    }

    const { data: org } = await context.supabase
      .from("organisations")
      .select("name, timezone, public_contact_email, public_contact_phone")
      .eq("id", booking.org_id)
      .maybeSingle();

    const { DEFAULT_TIMEZONE, zonedWallTimeToUtc } = await import("@/lib/timezone");
    const tz = org?.timezone || DEFAULT_TIMEZONE;
    const duration =
      (booking.service as unknown as { duration_minutes?: number } | null)?.duration_minutes ?? 60;

    const slots = data.slots.map((s) => {
      const startsAt = zonedWallTimeToUtc(s.date, s.time, tz);
      return {
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
      };
    });
    if (slots.some((s) => new Date(s.starts_at).getTime() < Date.now())) {
      return { ok: false as const, error: "Proposed times must be in the future." };
    }

    // Only one live offer per booking — a superseded one is withdrawn so its
    // link stops working the moment new times go out.
    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    const operatorName = await displayNameForUser(context.supabase, context.userId);
    await context.supabase
      .from("booking_offers")
      .update({ status: "withdrawn" })
      .eq("booking_id", booking.id)
      .eq("status", "open");

    const { newOfferToken, offerUrl, slotLabelFor, OFFER_TTL_HOURS } = await import(
      "@/lib/booking-offers.server"
    );
    const { token, hash } = newOfferToken();
    const expiresAt = new Date(Date.now() + OFFER_TTL_HOURS * 3600_000).toISOString();

    const { data: offer, error: oErr } = await context.supabase
      .from("booking_offers")
      .insert({
        org_id: booking.org_id,
        booking_id: booking.id,
        client_id: booking.client_id,
        practitioner_id: data.practitioner_id,
        service_id: booking.service_id,
        token_hash: hash,
        expires_at: expiresAt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (oErr || !offer) return { ok: false as const, error: oErr?.message ?? "Could not save the offer." };

    const { error: sErr } = await context.supabase.from("booking_offer_slots").insert(
      slots.map((s) => ({ offer_id: offer.id, org_id: booking.org_id, ...s })),
    );
    if (sErr) return { ok: false as const, error: sErr.message };

    const clientRow = booking.client as unknown as {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;

    let emailed = false;
    if (!data.verbal_only && clientRow?.email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const res = await sendTemplateEmail("booking-alternates-offered", clientRow.email, {
          templateData: {
            orgName: org?.name ?? "the clinic",
            clientName: clientRow.first_name,
            serviceName:
              (booking.service as unknown as { name?: string } | null)?.name ?? "your session",
            slots: slots.map((s) => slotLabelFor(s.starts_at, tz)),
            chooseUrl: offerUrl(token),
            expiresLabel: slotLabelFor(expiresAt, tz),
            note: data.note ?? "",
            contactEmail: org?.public_contact_email ?? "",
            contactPhone: org?.public_contact_phone ?? "",
          },
          replyTo: org?.public_contact_email ?? undefined,
          idempotencyKey: `offer-${offer.id}`,
        });
        emailed = res.sent;
      } catch (err) {
        console.error("alternates email failed", err);
      }
    }

    await writeBookingEvent(context.supabase, {
      orgId: booking.org_id,
      bookingId: booking.id,
      clientId: booking.client_id,
      eventType: "alternates_offered",
      actorUserId: context.userId,
      actorName: operatorName,
      requesterName: clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : null,
      requesterEmail: clientRow?.email ?? null,
      detail: {
        offer_id: offer.id,
        slot_count: slots.length,
        channel: data.verbal_only ? "verbal" : "email",
        emailed,
        expires_at: expiresAt,
      },
    });

    return { ok: true as const, emailed, offer_id: offer.id, verbal: data.verbal_only };
  });

export const withdrawOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ offer_id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: offer } = await context.supabase
      .from("booking_offers")
      .select("id, org_id, booking_id, client_id, status")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (!offer) return { ok: false as const, error: "Offer not found" };
    if (offer.status !== "open") return { ok: false as const, error: "That offer is already closed." };

    const { error } = await context.supabase
      .from("booking_offers")
      .update({ status: "withdrawn" })
      .eq("id", data.offer_id);
    if (error) return { ok: false as const, error: error.message };

    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    await writeBookingEvent(context.supabase, {
      orgId: offer.org_id,
      bookingId: offer.booking_id,
      clientId: offer.client_id,
      eventType: "alternates_withdrawn",
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
      detail: { offer_id: offer.id },
    });
    return { ok: true as const };
  });

/**
 * Operator-side acceptance for the verbal path: the client said yes on the
 * phone, so the operator books the slot for them. Same confirmation path.
 */
export const acceptAlternateForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ offer_id: uuid, slot_id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { acceptOfferSlot } = await import("@/lib/offer-accept.server");
    const { displayNameForUser } = await import("@/lib/booking-safety.server");
    return acceptOfferSlot(context.supabase, {
      offerId: data.offer_id,
      slotId: data.slot_id,
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
      channel: "verbal",
    });
  });
