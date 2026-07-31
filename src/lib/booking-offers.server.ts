/**
 * Server-only helpers for proposed alternate times.
 *
 * Tokens: 32 random bytes, base64url. Only the SHA-256 hash is stored, so a
 * database read can never reconstruct a working link. Tokens are single-use
 * and expire in 24 hours.
 */
import { createHash, randomBytes } from "crypto";
import { formatInTz, tzAbbrev, DEFAULT_TIMEZONE } from "./timezone";

type AnyClient = { from: (table: string) => any };

export const OFFER_TTL_HOURS = 24;
export const OFFER_REMINDER_AFTER_HOURS = 13;
export const SITE_URL = "https://resonabed.com";

export function newOfferToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function offerUrl(token: string): string {
  return `${SITE_URL}/offer/${token}`;
}

export function slotLabelFor(startsAt: string, tz: string): string {
  return `${formatInTz(startsAt, tz || DEFAULT_TIMEZONE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  })} (${tzAbbrev(tz || DEFAULT_TIMEZONE)})`;
}

/**
 * Close out offers that ran out of time, and nudge the ones about to.
 * Idempotent: safe to run on any schedule, from cron or on demand.
 */
export async function tickOffers(admin: AnyClient): Promise<{
  expired: number;
  reminded: number;
}> {
  const now = new Date();
  const { writeBookingEvent } = await import("./booking-safety.server");

  // --- expire -------------------------------------------------------------
  const { data: stale } = await admin
    .from("booking_offers")
    .select("id, org_id, booking_id, client_id")
    .eq("status", "open")
    .lt("expires_at", now.toISOString());

  for (const offer of stale ?? []) {
    await admin.from("booking_offers").update({ status: "expired" }).eq("id", offer.id);
    await writeBookingEvent(admin, {
      orgId: offer.org_id,
      bookingId: offer.booking_id,
      clientId: offer.client_id,
      eventType: "alternates_expired",
      detail: { offer_id: offer.id },
    });
  }

  // --- remind -------------------------------------------------------------
  const remindBefore = new Date(
    now.getTime() + (OFFER_TTL_HOURS - OFFER_REMINDER_AFTER_HOURS) * 3600_000,
  ).toISOString();

  const { data: due } = await admin
    .from("booking_offers")
    .select(
      `id, org_id, booking_id, client_id, expires_at,
       client:client_id(first_name, email),
       org:org_id(name, timezone, public_contact_email, public_show_email)`,
    )
    .eq("status", "open")
    .is("reminded_at", null)
    .gt("expires_at", now.toISOString())
    .lt("expires_at", remindBefore);

  let reminded = 0;
  for (const offer of due ?? []) {
    const client = offer.client as { first_name: string; email: string | null } | null;
    const org = offer.org as {
      name: string;
      timezone: string | null;
      public_contact_email: string | null;
      public_show_email: boolean | null;
    } | null;
    // The reminder deliberately carries no fresh link — the client still has
    // the original email, and re-sending a live token widens the window.
    if (client?.email) {
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("booking-alternates-reminder", client.email, {
          templateData: {
            orgName: org?.name ?? "the clinic",
            clientName: formatPersonName(client.first_name),
            expiresLabel: slotLabelFor(offer.expires_at, org?.timezone ?? DEFAULT_TIMEZONE),
            contactEmail: publishedContact(org).email,
          },
          replyTo: publishedContact(org).replyTo,
          idempotencyKey: `offer-reminder-${offer.id}`,
        });
        reminded += 1;
      } catch (err) {
        console.error("offer reminder failed", err);
      }
    }
    await admin
      .from("booking_offers")
      .update({ reminded_at: now.toISOString() })
      .eq("id", offer.id);
    await writeBookingEvent(admin, {
      orgId: offer.org_id,
      bookingId: offer.booking_id,
      clientId: offer.client_id,
      eventType: "alternates_reminded",
      detail: { offer_id: offer.id },
    });
  }

  return { expired: (stale ?? []).length, reminded };
}
