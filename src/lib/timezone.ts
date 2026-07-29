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

/** "YYYY-MM-DD" for an instant, as seen in `tz`. */
export function isoDateInTz(iso: string | Date, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date in `tz` (never the device's date). */
export function todayInTz(tz: string): string {
  return isoDateInTz(new Date(), tz);
}

/** Minutes from midnight of an instant, as seen in `tz`. */
export function minutesOfDayInTz(iso: string | Date, tz: string): number {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}

/** Day-of-week (0=Sun) of an instant, as seen in `tz`. */
export function dayOfWeekInTz(iso: string | Date, tz: string): number {
  const [y, m, d] = isoDateInTz(iso, tz).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Day-of-week (0=Sun) of a plain "YYYY-MM-DD" calendar date. No tz involved. */
export function dayOfWeekOfDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Shift a "YYYY-MM-DD" calendar date by n days. Pure calendar arithmetic. */
export function addDaysToDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Sunday that starts the week containing `dateStr`. */
export function startOfWeekDate(dateStr: string): string {
  return addDaysToDate(dateStr, -dayOfWeekOfDate(dateStr));
}

/** UTC instant of midnight at the start of `dateStr` in `tz`. */
export function dayStartUtc(dateStr: string, tz: string): Date {
  return zonedWallTimeToUtc(dateStr, "00:00", tz);
}

/** Format a plain calendar date for display. Never touches instants/tz. */
export function formatDateLabel(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" },
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", ...opts }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "9:30am"-style label for minutes-from-midnight. Wall clock, no tz shift. */
export function minutesLabel(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return slotLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

/** Short human timezone label, e.g. "AEST". */
export function tzAbbrev(tz: string): string {
  const part = new Intl.DateTimeFormat("en-AU", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}
