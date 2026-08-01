/**
 * Booking-side safety and vetting layer: block list, protected client notes,
 * and the append-only booking audit trail.
 *
 * Nothing in here is reachable from the public surface, every function is
 * behind requireSupabaseAuth and RLS scopes rows to the caller's org.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------- audit trail

export const listBookingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        booking_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("booking_events")
      .select(
        "id, booking_id, client_id, event_type, reason_code, actor_user_id, actor_name, requester_name, requester_email, requester_phone, detail, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.booking_id) q = q.eq("booking_id", data.booking_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Written when an operator opens a public request for review. Deduped to one
 * row per operator per booking per hour so the trail stays readable.
 */
export const logBookingViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ booking_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings")
      .select("id, org_id, client_id")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking) return { ok: false as const };

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await context.supabase
      .from("booking_events")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", data.booking_id)
      .eq("event_type", "viewed")
      .eq("actor_user_id", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: true as const, deduped: true };

    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    await writeBookingEvent(context.supabase, {
      orgId: booking.org_id,
      bookingId: booking.id,
      clientId: booking.client_id,
      eventType: "viewed",
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
    });
    return { ok: true as const };
  });

/**
 * Records that a private note was written while reviewing this request. The
 * note body itself never leaves protected client notes.
 */
export const logBookingNoteAdded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ booking_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings")
      .select("id, org_id, client_id")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking) return { ok: false as const };
    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    await writeBookingEvent(context.supabase, {
      orgId: booking.org_id,
      bookingId: booking.id,
      clientId: booking.client_id,
      eventType: "note_added",
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
    });
    return { ok: true as const };
  });

// ----------------------------------------------------------------- block list

export const listBlockedContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blocked_contacts")
      .select("id, display_name, email, phone, reason, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const blockContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        display_name: z.string().trim().max(160).optional().nullable(),
        email: z.string().trim().max(255).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        reason: z.string().trim().max(500).optional().nullable(),
        booking_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const email = data.email?.trim() || null;
    const phone = data.phone?.trim() || null;
    if (!email && !phone) throw new Error("A phone number or email is required to block someone.");

    const { writeBookingEvent, displayNameForUser, orgIdForUser } =
      await import("@/lib/booking-safety.server");
    const orgId = await orgIdForUser(context.supabase, context.userId);

    const { data: row, error } = await context.supabase
      .from("blocked_contacts")
      .insert({
        org_id: orgId,
        display_name: data.display_name ?? null,
        email,
        phone,
        reason: data.reason ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeBookingEvent(context.supabase, {
      orgId,
      bookingId: data.booking_id ?? null,
      eventType: "blocked",
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
      requesterName: data.display_name ?? null,
      requesterEmail: email,
      requesterPhone: phone,
      detail: { blocked_contact_id: row.id },
    });
    return { ok: true as const, id: row.id as string };
  });

export const unblockContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("blocked_contacts")
      .select("id, org_id, display_name, email, phone")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("That block no longer exists.");

    const { error } = await context.supabase.from("blocked_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    const { writeBookingEvent, displayNameForUser } = await import("@/lib/booking-safety.server");
    await writeBookingEvent(context.supabase, {
      orgId: existing.org_id,
      eventType: "unblocked",
      actorUserId: context.userId,
      actorName: await displayNameForUser(context.supabase, context.userId),
      requesterName: existing.display_name,
      requesterEmail: existing.email,
      requesterPhone: existing.phone,
    });
    return { ok: true as const };
  });

// ------------------------------------------------------- protected client notes

export const listClientNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ client_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_notes")
      .select("id, kind, body, author_id, author_name, created_at")
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        client_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        kind: z.enum(["general", "vetting_call"]).default("general"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: client } = await context.supabase
      .from("clients")
      .select("id, org_id")
      .eq("id", data.client_id)
      .maybeSingle();
    if (!client) throw new Error("Client not found");

    const { displayNameForUser } = await import("@/lib/booking-safety.server");
    const { pseudonymForClient } = await import("@/lib/pseudonym.server");
    const { error } = await context.supabase.from("client_notes").insert({
      org_id: client.org_id,
      client_id: client.id,
      pseudonym_id: await pseudonymForClient(context.supabase, client.id),
      author_id: context.userId,
      author_name: await displayNameForUser(context.supabase, context.userId),
      kind: data.kind,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
