/**
 * Server-only safety helpers for the booking pipeline.
 *
 * Two jobs:
 *   1. Identity matching — "is this the same person?" — on normalised phone OR
 *      email. Phone is the stronger signal but either match counts, because a
 *      block keyed on both together is walked through by changing one field.
 *   2. Append-only audit writes into public.booking_events.
 */
import { normaliseEmail, normalisePhone } from "./phone";

type AnyClient = {
  from: (table: string) => any;
};

export type BookingEventType =
  | "request_received"
  | "viewed"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "blocked_attempt"
  | "blocked"
  | "unblocked"
  | "note_added"
  | "alternates_offered"
  | "alternates_reminded"
  | "alternates_accepted"
  | "alternates_expired"
  | "alternates_withdrawn"
  | "re_requested";


export interface BookingEventInput {
  orgId: string;
  bookingId?: string | null;
  clientId?: string | null;
  eventType: BookingEventType;
  reasonCode?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Append-only. Never carries health detail — decline reasons are codes.
 */
export async function writeBookingEvent(
  client: AnyClient,
  input: BookingEventInput,
): Promise<void> {
  const { error } = await client.from("booking_events").insert({
    org_id: input.orgId,
    booking_id: input.bookingId ?? null,
    client_id: input.clientId ?? null,
    event_type: input.eventType,
    reason_code: input.reasonCode ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_name: input.actorName ?? null,
    requester_name: input.requesterName ?? null,
    requester_email: input.requesterEmail ?? null,
    requester_phone: input.requesterPhone ?? null,
    detail: input.detail ?? {},
  });
  if (error) {
    // The audit row is the point of the feature; surface failures loudly in
    // logs, but never break the caller's flow on a logging problem.
    console.error("booking_events insert failed", error.message);
  }
}

/** True when this person is on the org's block list (phone OR email). */
export async function isBlockedContact(
  client: AnyClient,
  args: { orgId: string; email?: string | null; phone?: string | null },
): Promise<boolean> {
  const email = normaliseEmail(args.email);
  const phone = normalisePhone(args.phone);
  if (!email && !phone) return false;

  const filters: string[] = [];
  if (phone) filters.push(`phone_normalised.eq.${phone}`);
  if (email) filters.push(`email.ilike.${email}`);

  const { data } = await client
    .from("blocked_contacts")
    .select("id")
    .eq("org_id", args.orgId)
    .or(filters.join(","))
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Every client row in the org that plausibly IS this person: normalised phone
 * match or email match. Used both to reuse a client record on a public request
 * and to decide first-time vs returning.
 */
export async function findMatchingClientIds(
  client: AnyClient,
  args: { orgId: string; email?: string | null; phone?: string | null },
): Promise<string[]> {
  const email = normaliseEmail(args.email);
  const phone = normalisePhone(args.phone);
  if (!email && !phone) return [];

  const filters: string[] = [];
  if (phone) filters.push(`phone_normalised.eq.${phone}`);
  if (email) filters.push(`email.ilike.${email}`);

  const { data } = await client
    .from("clients")
    .select("id")
    .eq("org_id", args.orgId)
    .or(filters.join(","));

  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Returning = any prior non-cancelled booking, session, or screening in this
 * org across every client row that matches this person. `excludeBookingId` is
 * the request being reviewed — it must not make its own requester look
 * returning.
 */
export async function isReturningPerson(
  client: AnyClient,
  args: { orgId: string; clientIds: string[]; excludeBookingId?: string | null },
): Promise<boolean> {
  if (args.clientIds.length === 0) return false;

  let bookingQuery = client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("org_id", args.orgId)
    .in("client_id", args.clientIds)
    .neq("status", "cancelled");
  if (args.excludeBookingId) bookingQuery = bookingQuery.neq("id", args.excludeBookingId);

  const [bookings, sessions, screenings] = await Promise.all([
    bookingQuery,
    client
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", args.orgId)
      .in("client_id", args.clientIds)
      .neq("status", "cancelled"),
    client
      .from("client_screenings")
      .select("id", { count: "exact", head: true })
      .eq("org_id", args.orgId)
      .in("client_id", args.clientIds),
  ]);

  return (
    (bookings.count ?? 0) > 0 || (sessions.count ?? 0) > 0 || (screenings.count ?? 0) > 0
  );
}

// ---------------------------------------------------------------------------
// Small context helpers used by the authenticated server functions.
// ---------------------------------------------------------------------------

export async function orgIdForUser(
  client: AnyClient,
  userId: string,
): Promise<string> {
  const { data } = await client.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (!data?.org_id) throw new Error("No organisation assigned to your profile");
  return data.org_id as string;
}

export async function displayNameForUser(
  client: AnyClient,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | null) ?? null;
}
