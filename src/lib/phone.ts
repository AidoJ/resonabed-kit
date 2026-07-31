/**
 * Client-safe phone normalisation, mirroring `public.normalise_phone` in the
 * database exactly. Both sides must agree, because the normalised value is the
 * primary matching key for "is this a returning client?" and for blocking.
 *
 * Rule: digits only; if 9 or more digits remain, keep the last 9. That makes
 * "+61 412 345 678", "0412 345 678" and "0412345678" all collapse to the same
 * key without needing a full E.164 parser.
 */
export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export function normaliseEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}
