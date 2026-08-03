/**
 * Greeting names are typed by clients into a public form, so they arrive as
 * "AIDAN", "aidan" or "aIdan" as often as "Aidan". Emails address a real
 * person; shouting their name back at them reads as spam.
 *
 * Only normalise when the input is uniformly cased, anything with a
 * deliberate internal capital (McKenzie, DeLuca) is left exactly as given.
 */
function capitalisePart(part: string): string {
  if (!part) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

export function formatPersonName(raw: string | null | undefined, fallback = "there"): string {
  const value = (raw ?? "").trim();
  if (!value) return fallback;

  const letters = value.replace(/[^A-Za-z]/g, "");
  const isAllUpper = letters.length > 0 && letters === letters.toUpperCase();
  const isAllLower = letters.length > 0 && letters === letters.toLowerCase();
  if (!isAllUpper && !isAllLower) return value;

  return value
    .split(/(\s+|-|’|')/)
    .map((chunk) => (/^[\s\-’']+$/.test(chunk) ? chunk : capitalisePart(chunk)))
    .join("");
}

/** Reduce a stored display name to a first name plus surname initial ("Aidan L."). */
export function publicShortName(raw: string | null | undefined): string {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = formatPersonName(parts[0], "");
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
