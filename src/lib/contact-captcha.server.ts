/**
 * Lightweight server-verified captcha for the public contact form.
 *
 * The server issues a small arithmetic challenge plus a signed token that
 * encodes the expected answer and an expiry. The answer never travels to the
 * client, so a bot cannot derive it from the token, and the token cannot be
 * forged without the server secret.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "resonabed-contact-captcha";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueChallenge(): { question: string; token: string } {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a + b;
  const expires = Date.now() + TTL_MS;
  const payload = `${answer}.${expires}`;
  return {
    question: `What is ${a} + ${b}?`,
    token: `${payload}.${sign(payload)}`,
  };
}

export type CaptchaVerdict = { ok: true } | { ok: false; reason: string };

export function verifyChallenge(token: string, answer: string): CaptchaVerdict {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [expected, expires, sig] = parts as [string, string, string];

  const good = sign(`${expected}.${expires}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  if (Number(expires) < Date.now()) return { ok: false, reason: "expired" };
  if (answer.trim() !== expected) return { ok: false, reason: "wrong" };
  return { ok: true };
}
