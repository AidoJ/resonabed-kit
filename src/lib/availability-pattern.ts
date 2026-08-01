/**
 * Working-pattern helpers.
 *
 * A "pattern" is the clinic's MERGED weekly working window, day-of-week plus
 * wall-clock start/end in the org's timezone. It deliberately carries no
 * practitioner identity and no booking data, so publishing it never reveals
 * who works when, nor which slots are taken.
 */
import { dayOfWeekOfDate } from "./timezone";

export interface AvailabilityWindow {
  day_of_week: number; // 0 = Sunday
  start_time: string; // "09:00" or "09:00:00"
  end_time: string;
}

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SHORT_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Windows that apply to a plain "YYYY-MM-DD" calendar date. */
export function windowsForDate(
  pattern: AvailabilityWindow[],
  dateStr: string,
): AvailabilityWindow[] {
  const dow = dayOfWeekOfDate(dateStr);
  return pattern.filter((w) => w.day_of_week === dow);
}

/**
 * Half-hour start times on `dateStr` that fit a session of `durationMinutes`
 * entirely inside a working window. Empty when the clinic doesn't work that
 * day.
 */
export function slotsForDate(
  pattern: AvailabilityWindow[],
  dateStr: string,
  durationMinutes: number,
): string[] {
  const out = new Set<string>();
  for (const w of windowsForDate(pattern, dateStr)) {
    const start = toMinutes(w.start_time);
    const end = toMinutes(w.end_time);
    for (let t = start; t + durationMinutes <= end; t += 30) out.add(fromMinutes(t));
  }
  return Array.from(out).sort();
}

/** True when the whole session fits inside a working window on that date. */
export function isWithinPattern(
  pattern: AvailabilityWindow[],
  dateStr: string,
  timeStr: string,
  durationMinutes: number,
): boolean {
  const start = toMinutes(timeStr);
  return windowsForDate(pattern, dateStr).some(
    (w) => start >= toMinutes(w.start_time) && start + durationMinutes <= toMinutes(w.end_time),
  );
}

/** True when the clinic works at all on that calendar date. */
export function isWorkingDate(pattern: AvailabilityWindow[], dateStr: string): boolean {
  return windowsForDate(pattern, dateStr).length > 0;
}

function label12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}

/** Human summary, e.g. "Tue, Thu, Sat 9am – 3pm". */
export function describePattern(pattern: AvailabilityWindow[]): string[] {
  const byRange = new Map<string, number[]>();
  for (const w of pattern) {
    const key = `${label12h(w.start_time)} – ${label12h(w.end_time)}`;
    const days = byRange.get(key) ?? [];
    days.push(w.day_of_week);
    byRange.set(key, days);
  }
  return Array.from(byRange.entries()).map(
    ([range, days]) =>
      `${days
        .sort((a, b) => a - b)
        .map((d) => SHORT_DAY_LABELS[d])
        .join(", ")} · ${range}`,
  );
}
