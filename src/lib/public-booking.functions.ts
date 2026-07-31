import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { zonedWallTimeToUtc, DEFAULT_TIMEZONE } from "./timezone";

const requestSchema = z.object({
  slug: z.string().min(1).max(64),
  service_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  // Phone is REQUIRED on the public path: it is the operator's
  // verification-by-call tool and the stronger of the two blocking signals.
  phone: z.string().trim().min(6).max(40),
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

    // --- Client: reuse an existing record for this email, else create ---
    const email = data.email.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("org_id", org.id)
      .ilike("email", email)
      .maybeSingle();

    let clientId = existing?.id ?? null;
    if (!clientId) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("clients")
        .insert({
          org_id: org.id,
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          email,
          phone: data.phone?.trim() || null,
        })
        .select("id")
        .single();
      if (cErr || !created) {
        return { ok: false, error: "We couldn't submit your request. Please try again." };
      }
      clientId = created.id;
    }

    // --- Write: always pending, never assigned, never confirmed ---------
    const { error: bErr } = await supabaseAdmin.from("bookings").insert({
      org_id: org.id,
      client_id: clientId,
      service_id: service.id,
      practitioner_id: null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      source: "public",
      public_note: data.note?.trim() || null,
    });

    if (bErr) {
      await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: false });
      return { ok: false, error: "We couldn't submit your request. Please try again." };
    }

    await recordAttempt(supabaseAdmin, { orgId: org.id, ipHash, emailHash, accepted: true });
    await notifyOperator(org.name, org.public_contact_email);

    return { ok: true };
  });
