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

/**
 * Australian-first phone validation shared by the browser form and the server.
 *
 * Accepted shapes:
 *   - Mobile:    04xxxxxxxx (exactly 10 digits, starts 04)
 *   - Landline:  xxxxxxxx (8 digits, local) or 0[2378]xxxxxxxx (10 digits)
 *   - Overseas:  +<country code><number>, 8–15 digits in total
 * Spaces, brackets, dashes and dots are ignored.
 */
export const PHONE_HELP_TEXT =
  "Mobile 04xxxxxxxx, landline 8 digits (or with area code, e.g. 03xxxxxxxx), or +country code for overseas numbers.";

export function phoneValidationError(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "Please enter a phone number.";
  if (/[^\d+\s().-]/.test(value)) return "Phone numbers can only contain digits, spaces, + ( ) - .";

  const international = value.startsWith("+");
  const digits = value.replace(/\D/g, "");

  if (international) {
    if (digits.length < 8 || digits.length > 15)
      return "Enter the country code and number, e.g. +64 21 123 4567.";
    return null;
  }

  if (digits.startsWith("04")) {
    return digits.length === 10
      ? null
      : "Australian mobile numbers are 10 digits, starting 04 (e.g. 0412 345 678).";
  }
  if (digits.length === 8) return null;
  if (digits.length === 10 && /^0[2378]/.test(digits)) return null;

  return "Enter an 8-digit landline, a 10-digit number starting 02/03/04/07/08, or +country code for overseas.";
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return phoneValidationError(raw) === null;
}
