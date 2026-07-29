/**
 * Server-only helpers for the anonymous public booking endpoint.
 *
 * Guard order enforced by the caller:
 *   1. verifyCaptcha()   <- deliberate stub today, drop-in later
 *   2. rate limits (ip / email / org)
 *   3. validation + write (always status = 'pending')
 */
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// 1. Captcha seam
// ---------------------------------------------------------------------------

export type CaptchaResult = { ok: true } | { ok: false; reason: string };

/**
 * FIRST guard in the request handler.
 *
 * Today this is an intentional no-op: with no captcha keys configured it
 * returns ok and lets the request through. This is deliberately *fail-open*,
 * because nothing is published yet and rate limiting + pending-until-confirmed
 * are what actually protect the endpoint.
 *
 * To enable Cloudflare Turnstile later, set TURNSTILE_SECRET_KEY (and the
 * matching VITE_TURNSTILE_SITE_KEY on the client) and implement the verify
 * call below. No other part of the handler changes.
 */
export async function verifyCaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // No keys configured -> captcha disabled -> allow.
    return { ok: true };
  }

  if (!token) return { ok: false, reason: "captcha_missing" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success ? { ok: true } : { ok: false, reason: "captcha_failed" };
  } catch {
    // Verification service unreachable: with keys configured we fail closed.
    return { ok: false, reason: "captcha_unavailable" };
  }
}

// ---------------------------------------------------------------------------
// 2. Rate limiting
// ---------------------------------------------------------------------------

/** One-way hash; we never persist raw IPs or emails in the attempts ledger. */
export function hashValue(value: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "resonabed";
  return createHash("sha256").update(`${salt}:${value.trim().toLowerCase()}`).digest("hex");
}

export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const RATE_LIMITS = {
  perIpPerHour: 5,
  perEmailPerHour: 3,
  perOrgPerHour: 20,
} as const;

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type RateLimitVerdict = { ok: true } | { ok: false; reason: string };

export async function checkRateLimits(
  admin: AdminClient,
  args: { orgId: string; ipHash: string; emailHash: string },
): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [ipRes, emailRes, orgRes] = await Promise.all([
    admin
      .from("public_booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", args.ipHash)
      .gte("created_at", since),
    admin
      .from("public_booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", args.emailHash)
      .gte("created_at", since),
    admin
      .from("public_booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", args.orgId)
      .gte("created_at", since),
  ]);

  if ((ipRes.count ?? 0) >= RATE_LIMITS.perIpPerHour) return { ok: false, reason: "ip" };
  if ((emailRes.count ?? 0) >= RATE_LIMITS.perEmailPerHour) return { ok: false, reason: "email" };
  if ((orgRes.count ?? 0) >= RATE_LIMITS.perOrgPerHour) return { ok: false, reason: "org" };
  return { ok: true };
}

export async function recordAttempt(
  admin: AdminClient,
  args: { orgId: string; ipHash: string; emailHash: string; accepted: boolean },
): Promise<void> {
  await admin.from("public_booking_attempts").insert({
    org_id: args.orgId,
    ip_hash: args.ipHash,
    email_hash: args.emailHash,
    accepted: args.accepted,
  });
}

// ---------------------------------------------------------------------------
// 3. Operator nudge (no client PII in the message body)
// ---------------------------------------------------------------------------

export async function notifyOperator(orgName: string, to: string | null): Promise<void> {
  if (!to) return;
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("public-booking-request", to, {
      templateData: {
        orgName,
        loginUrl: "https://resonabed.com/bookings",
      },
    });
  } catch (err) {
    // Never fail the visitor's request because a notification bounced.
    console.error("public booking notification failed", err);
  }
}
