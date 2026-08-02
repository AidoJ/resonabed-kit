/**
 * The single confirmation path.
 *
 * Manual confirmation from the review dialog and a client accepting a proposed
 * alternate time BOTH land here, so the address-release gate, the audit trail
 * and the confirmation email are byte-identical no matter which door was used.
 */
import { formatOrgAddress } from "./org-address";
import { formatInTz, tzAbbrev, DEFAULT_TIMEZONE } from "./timezone";
import { writeBookingEvent } from "./booking-safety.server";
import { ORG_CONTACT_COLUMNS, confirmedClientContact } from "./org-public-contact";
import { formatPersonName } from "./person-name";

type AnyClient = { from: (table: string) => any };

export interface ConfirmArgs {
  bookingId: string;
  practitionerId: string;
  /** Set when the client accepted a proposed slot; leaves the time untouched otherwise. */
  startsAt?: string;
  endsAt?: string;
  actorUserId?: string | null;
  actorName?: string | null;
  /** Extra audit context, e.g. { offer_id, accepted_by: 'client' }. */
  detail?: Record<string, unknown>;
  eventType?: "confirmed" | "alternates_accepted" | "rescheduled";
  /** Wording switch for an already-confirmed booking that has been moved. */
  rescheduled?: boolean;
}


export interface ConfirmResult {
  ok: boolean;
  emailed: boolean;
  error?: string;
}

export async function confirmBookingAndNotify(
  client: AnyClient,
  args: ConfirmArgs,
): Promise<ConfirmResult> {
  const { data: booking } = await client
    .from("bookings")
    .select(
      `id, org_id, status, client_id, starts_at,
       client:client_id(first_name, last_name, email),
       service:service_id(name)`,
    )
    .eq("id", args.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, emailed: false, error: "Booking not found" };

  const update: Record<string, unknown> = {
    status: "confirmed",
    practitioner_id: args.practitionerId,
  };
  if (args.startsAt) update.starts_at = args.startsAt;
  if (args.endsAt) update.ends_at = args.endsAt;

  const { error: uErr } = await client.from("bookings").update(update).eq("id", args.bookingId);
  if (uErr) {
    // The partial unique index on confirmed slots is what makes
    // first-to-confirm-wins real rather than aspirational.
    const clash = /duplicate key|bookings_confirmed_slot_uniq/i.test(uErr.message);
    return {
      ok: false,
      emailed: false,
      error: clash
        ? "That time has just been taken. Please choose another."
        : uErr.message,
    };
  }

  const clientRow = booking.client as {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;

  await writeBookingEvent(client, {
    orgId: booking.org_id,
    bookingId: booking.id,
    clientId: booking.client_id,
    eventType: args.eventType ?? "confirmed",
    actorUserId: args.actorUserId ?? null,
    actorName: args.actorName ?? null,
    requesterName: clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : null,
    requesterEmail: clientRow?.email ?? null,
    detail: { practitioner_id: args.practitionerId, ...(args.detail ?? {}) },
  });

  // --- Address release: only now, only to the confirmed client -------------
  let emailed = false;
  try {
    if (clientRow?.email) {
      const { data: org } = await client
        .from("organisations")
        .select(
          `name, clinic_type, timezone, ${ORG_CONTACT_COLUMNS}, address_line1, address_line2, address_city, address_state, address_postcode, address_country`,
        )
        .eq("id", booking.org_id)
        .maybeSingle();

      // Private contact details stay private here too, the page and the
      // email must never disagree about what the client can see.
      const contact = publishedContact(org);

      const tz = (org?.timezone as string) || DEFAULT_TIMEZONE;
      const when = args.startsAt ?? (booking.starts_at as string);
      const whenLabel = `${formatInTz(when, tz, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
      })} (${tzAbbrev(tz)})`;

      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const result = await sendTemplateEmail("booking-confirmed", clientRow.email, {
        templateData: {
          orgName: org?.name ?? "Your clinic",
          clientName: formatPersonName(clientRow.first_name),
          serviceName: (booking.service as { name?: string } | null)?.name ?? "your session",
          whenLabel,
          address: formatOrgAddress(org ?? {}),
          isHomeBased: (org?.clinic_type ?? "home") === "home",
          contactPhone: contact.phone,
          contactEmail: contact.email,
        },
        replyTo: contact.replyTo,
        idempotencyKey: `booking-confirmed-${args.bookingId}-${when}`,
      });
      emailed = result.sent;
    }
  } catch (err) {
    // A bounced confirmation must not roll back the confirmation itself.
    console.error("booking confirmation email failed", err);
  }

  return { ok: true, emailed };
}
