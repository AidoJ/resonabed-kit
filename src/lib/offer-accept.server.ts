/**
 * Shared acceptance path for a proposed alternate time.
 *
 * Used by the client's tokenised link and by the operator when the client
 * accepted verbally. Both routes end in confirmBookingAndNotify, so the
 * address-release gate and audit trail are identical.
 */
import { confirmBookingAndNotify } from "./booking-confirm.server";
import { writeBookingEvent } from "./booking-safety.server";

type AnyClient = { from: (table: string) => any };

export interface AcceptResult {
  ok: boolean;
  error?: string;
  emailed?: boolean;
}

export async function acceptOfferSlot(
  client: AnyClient,
  args: {
    offerId: string;
    slotId: string;
    actorUserId?: string | null;
    actorName?: string | null;
    channel: "link" | "verbal";
  },
): Promise<AcceptResult> {
  const { data: offer } = await client
    .from("booking_offers")
    .select("id, org_id, booking_id, client_id, practitioner_id, status, expires_at")
    .eq("id", args.offerId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "This link is no longer valid." };
  if (offer.status === "accepted") {
    return { ok: false, error: "These times have already been booked." };
  }
  if (offer.status !== "open") {
    return { ok: false, error: "These times are no longer available. Please contact the clinic." };
  }
  if (new Date(offer.expires_at).getTime() < Date.now()) {
    await client.from("booking_offers").update({ status: "expired" }).eq("id", offer.id);
    return { ok: false, error: "These times have expired. Please contact the clinic." };
  }

  const { data: slot } = await client
    .from("booking_offer_slots")
    .select("id, starts_at, ends_at")
    .eq("id", args.slotId)
    .eq("offer_id", offer.id)
    .maybeSingle();
  if (!slot) return { ok: false, error: "That time isn't part of this offer." };
  if (new Date(slot.starts_at).getTime() < Date.now()) {
    return { ok: false, error: "That time has already passed. Please contact the clinic." };
  }

  // Claim the offer first: whoever flips 'open' -> 'accepted' owns the slot.
  const { data: claimed } = await client
    .from("booking_offers")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_slot_id: slot.id,
    })
    .eq("id", offer.id)
    .eq("status", "open")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "These times have just been taken. Please contact the clinic." };
  }

  const res = await confirmBookingAndNotify(client, {
    bookingId: offer.booking_id,
    practitionerId: offer.practitioner_id,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    actorUserId: args.actorUserId ?? null,
    actorName: args.actorName ?? (args.channel === "link" ? "Client" : null),
    eventType: "alternates_accepted",
    detail: { offer_id: offer.id, slot_id: slot.id, channel: args.channel },
  });

  if (!res.ok) {
    // Release the claim so the client can try another time.
    await client.from("booking_offers").update({ status: "open", accepted_at: null, accepted_slot_id: null }).eq("id", offer.id);
    return { ok: false, error: res.error ?? "Could not book that time." };
  }

  return { ok: true, emailed: res.emailed };
}

/** Look up an open offer by its raw token. Never leaks health or address data. */
export async function loadOfferByToken(
  admin: AnyClient,
  token: string,
): Promise<
  | { ok: false; reason: "not_found" | "expired" | "accepted" | "withdrawn" }
  | {
      ok: true;
      offer: {
        id: string;
        expires_at: string;
        clinicName: string;
        timezone: string;
        serviceName: string;
        clientName: string;
        contactEmail: string | null;
        contactPhone: string | null;
        slots: { id: string; starts_at: string }[];
      };
    }
> {
  const { hashToken } = await import("./booking-offers.server");
  const { data: offer } = await admin
    .from("booking_offers")
    .select(
      `id, status, expires_at,
       org:org_id(name, timezone, public_contact_email, public_contact_phone),
       client:client_id(first_name),
       service:service_id(name),
       slots:booking_offer_slots(id, starts_at)`,
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!offer) return { ok: false, reason: "not_found" };
  if (offer.status === "accepted") return { ok: false, reason: "accepted" };
  if (offer.status === "withdrawn") return { ok: false, reason: "withdrawn" };
  if (offer.status === "expired" || new Date(offer.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const org = offer.org as {
    name: string;
    timezone: string | null;
    public_contact_email: string | null;
    public_contact_phone: string | null;
  } | null;

  return {
    ok: true,
    offer: {
      id: offer.id,
      expires_at: offer.expires_at,
      clinicName: org?.name ?? "Your clinic",
      timezone: org?.timezone ?? "Australia/Brisbane",
      serviceName: (offer.service as { name?: string } | null)?.name ?? "your session",
      clientName: (offer.client as { first_name?: string } | null)?.first_name ?? "there",
      contactEmail: org?.public_contact_email ?? null,
      contactPhone: org?.public_contact_phone ?? null,
      slots: ((offer.slots as { id: string; starts_at: string }[]) ?? []).sort((a, b) =>
        a.starts_at.localeCompare(b.starts_at),
      ),
    },
  };
}
