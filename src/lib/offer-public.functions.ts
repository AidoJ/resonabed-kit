/**
 * Anonymous, token-scoped endpoints for a client choosing one of the alternate
 * times their clinic proposed.
 *
 * The token is the only credential. It reveals nothing beyond the clinic name,
 * session type and the proposed times, no address (that stays behind the
 * confirmation gate), no health data, no other bookings.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().min(20).max(200);

export const getOffer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: tokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOfferByToken } = await import("./offer-accept.server");
    return loadOfferByToken(supabaseAdmin, data.token);
  });

export const acceptOffer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: tokenSchema, slot_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOfferByToken, acceptOfferSlot } = await import("./offer-accept.server");

    const found = await loadOfferByToken(supabaseAdmin, data.token);
    if (!found.ok) {
      return { ok: false as const, error: "This link is no longer valid. Please contact the clinic." };
    }
    const res = await acceptOfferSlot(supabaseAdmin, {
      offerId: found.offer.id,
      slotId: data.slot_id,
      channel: "link",
    });
    return res.ok
      ? { ok: true as const }
      : { ok: false as const, error: res.error ?? "Could not book that time." };
  });

/**
 * "None of these work", a dead end otherwise. Keeps the request alive and
 * tells the clinic to try again, without exposing anything new.
 */
export const declineOffer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: tokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashToken } = await import("./booking-offers.server");
    const { writeBookingEvent } = await import("./booking-safety.server");

    const { data: offer } = await supabaseAdmin
      .from("booking_offers")
      .select("id, org_id, booking_id, client_id, status")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (!offer || offer.status !== "open") return { ok: true as const };

    await supabaseAdmin.from("booking_offers").update({ status: "withdrawn" }).eq("id", offer.id);
    await writeBookingEvent(supabaseAdmin, {
      orgId: offer.org_id,
      bookingId: offer.booking_id,
      clientId: offer.client_id,
      eventType: "re_requested",
      actorName: "Client",
      detail: { offer_id: offer.id, reason: "none_suitable" },
    });
    return { ok: true as const };
  });
