/**
 * Timezone helpers.
 *
 * Rule for this app: instants are stored in UTC (`timestamptz`) and displayed
 * in the organisation's timezone. Never rely on the visitor's device timezone
 * for anything a clinic will act on.
 */

export const DEFAULT_TIMEZONE = "Australia/Brisbane";

/** Offset (ms) of `tz` from UTC at the given instant. Positive east of UTC. */
export function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock date + time *in `tz`* to the correct UTC instant.
 * Handles DST by re-checking the offset at the resolved instant.
 */
export function zonedWallTimeToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const off1 = tzOffsetMs(new Date(naive), tz);
  let ts = naive - off1;
  const off2 = tzOffsetMs(new Date(ts), tz);
  if (off2 !== off1) ts = naive - off2;
  return new Date(ts);
}

/** Format an instant as a time string in the given timezone. */
export function formatInTz(
  iso: string | Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, ...opts }).format(d);
}

/** Half-hour slot labels, e.g. "09:00" … "17:30". */
export function halfHourSlots(startHour = 7, endHour = 20): string[] {
  const out: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

export function slotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")}${suffix}`;
}
