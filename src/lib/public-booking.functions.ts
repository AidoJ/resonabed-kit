import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { zonedWallTimeToUtc, DEFAULT_TIMEZONE } from "./timezone";
import { phoneValidationError } from "./phone";

const requestSchema = z.object({
  slug: z.string().min(1).max(64),
  service_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  // Phone is REQUIRED on the public path: it is the operator's
  // verification-by-call tool and the stronger of the two blocking signals.
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => phoneValidationError(v) === null, {
      message:
        "Enter an Australian mobile (04xxxxxxxx), an 8-digit landline, or an overseas number starting with +.",
    }),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  captcha_token: z.string().max(4000).optional().nullable(),
});

export type PublicBookingResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Anonymous endpoint. Guard order is fixed:
 *   1. captcha (stubbed no-op until keys exist)
 *   2. rate limits
 *   3. org/service validation
 *   4. write as status='pending', source='public'
 */
export const requestPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<PublicBookingResult> => {
    const {
      verifyCaptcha,
      hashValue,
      clientIpFrom,
      checkRateLimits,
      recordAttempt,
      notifyOperator,
    } = await import("./public-booking.server");

    const headers = getRequest().headers;
    const ip = clientIpFrom(headers);

    // --- Guard 1: captcha ----------------------------------------------
    const captcha = await verifyCaptcha(data.captcha_token, ip);
    if (!captcha.ok) {
      return { ok: false, error: "We couldn't verify this request. Please try again." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the organisation from the public slug. Published + active only.
    const { data: org } = await supabaseAdmin
      .from("organisations")
      .select("id, name, timezone, public_booking_enabled, published, status, public_contact_email")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!org || !org.published || org.status !== "active" || !org.public_booking_enabled) {
      return { ok: false, error: "This clinic isn't accepting online requests right now." };
    }

    const ipHash = hashValue(ip);
    const emailHash = hashValue(data.email);

    // --- Guard 2: rate limits -------------------------------------------
    const limit = await checkRateLimits(supabaseAdmin, {
      orgId: org.id,
      ipHash,
      emailHash,
    });
    if (!limit.ok) {
      await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: false });
      return {
        ok: false,
        error: "Too many requests just now. Please try again later, or contact the clinic directly.",
      };
    }

    // --- Guard 3: service must belong to this org and be active ---------
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, duration_minutes, is_active, org_id")
      .eq("id", data.service_id)
      .maybeSingle();

    if (!service || service.org_id !== org.id || !service.is_active) {
      return { ok: false, error: "That session type is no longer available." };
    }

    // --- Time: interpret the chosen slot in the ORG's timezone ----------
    const tz = org.timezone || DEFAULT_TIMEZONE;
    const startsAt = zonedWallTimeToUtc(data.preferred_date, data.preferred_time, tz);
    if (Number.isNaN(startsAt.getTime())) {
      return { ok: false, error: "Please choose a valid date and time." };
    }
    if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) {
      return { ok: false, error: "Please choose a time at least an hour from now." };
    }
    if (startsAt.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 180) {
      return { ok: false, error: "Please choose a date within the next six months." };
    }
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

    // --- Guard 3b: the request must land inside the clinic's working pattern.
    // The form only offers valid times, but the form is not the security
    // boundary. When an org has published no hours at all we fall back to open
    // entry rather than silently killing their public page.
    {
      const { data: windows } = await supabaseAdmin
        .from("practitioner_availability")
        .select("day_of_week, start_time, end_time, practitioner:practitioner_id(is_active)")
        .eq("org_id", org.id)
        .eq("is_active", true);
      const pattern = (windows ?? [])
        .filter((w: any) => w.practitioner?.is_active !== false)
        .map((w: any) => ({
          day_of_week: w.day_of_week,
          start_time: w.start_time,
          end_time: w.end_time,
        }));
      if (pattern.length > 0) {
        const { isWithinPattern } = await import("./availability-pattern");
        if (
          !isWithinPattern(
            pattern,
            data.preferred_date,
            data.preferred_time,
            service.duration_minutes,
          )
        ) {
          return {
            ok: false,
            error: "That time is outside the clinic's working hours. Please choose another.",
          };
        }
      }
    }


    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const fullName = `${data.first_name.trim()} ${data.last_name.trim()}`;

    const { isBlockedContact, findMatchingClientIds, writeBookingEvent } = await import(
      "./booking-safety.server"
    );

    // --- Guard 4: block list (phone OR email) ---------------------------
    // Silent by design. A blocked person sees the ordinary "request received"
    // response — we neither confirm the block nor invite them to start
    // varying their details. Nothing reaches the operator's active queue, but
    // the attempt is logged so a pattern of evasion stays visible.
    if (await isBlockedContact(supabaseAdmin, { orgId: org.id, email, phone })) {
      await writeBookingEvent(supabaseAdmin, {
        orgId: org.id,
        eventType: "blocked_attempt",
        requesterName: fullName,
        requesterEmail: email,
        requesterPhone: phone,
        detail: {
          requested_for: startsAt.toISOString(),
          service_id: service.id,
        },
      });
      await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: false });
      return { ok: true };
    }

    // --- Client: reuse an existing record for this person ----------------
    // Matched on normalised phone OR email, so a typo'd address doesn't
    // fragment a returning client into a second record.
    const matchedIds = await findMatchingClientIds(supabaseAdmin, {
      orgId: org.id,
      email,
      phone,
    });

    let clientId = matchedIds[0] ?? null;
    if (!clientId) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("clients")
        .insert({
          org_id: org.id,
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          email,
          phone,
        })
        .select("id")
        .single();
      if (cErr || !created) {
        return { ok: false, error: "We couldn't submit your request. Please try again." };
      }
      clientId = created.id;
    } else {
      // Keep the phone on file current — it's the primary matching signal.
      await supabaseAdmin.from("clients").update({ phone }).eq("id", clientId).is("phone", null);
    }

    // --- Write: always pending, never assigned, never confirmed ---------
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        org_id: org.id,
        client_id: clientId,
        service_id: service.id,
        practitioner_id: null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
        source: "public",
        public_note: data.note?.trim() || null,
      })
      .select("id")
      .single();

    if (bErr || !booking) {
      await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: false });
      return { ok: false, error: "We couldn't submit your request. Please try again." };
    }

    await writeBookingEvent(supabaseAdmin, {
      orgId: org.id,
      bookingId: booking.id,
      clientId,
      eventType: "request_received",
      requesterName: fullName,
      requesterEmail: email,
      requesterPhone: phone,
      detail: { requested_for: startsAt.toISOString(), service_id: service.id },
    });

    await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: true });
    await notifyOperator(org.name, org.public_contact_email);

    return { ok: true };
  });
