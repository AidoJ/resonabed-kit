/**
 * Wellbeing Check (self-rating scales, 0–10).
 *
 * Every scale is RIGHT-POSITIVE: sliding right always means "feeling better".
 * Anything that needs the opposite semantics (the frequency matcher, legacy
 * session rows) must invert at the boundary, see toIntakeInputs() in
 * step-symptoms.tsx.
 *
 * These scales are an OUTCOME MEASURE ONLY. They are stored in their own
 * table (session_checkins) and are never read by the frequency-selection
 * logic in frequency-match.ts — tracking and session decisions stay
 * decoupled by construction.
 *
 * Language rule: wellbeing wording only. Never describe these ratings as
 * clinical, diagnostic, or a measure of treatment effect.
 */

export const CHECKIN_ITEM_KEYS = [
  "arousal",
  "mood",
  "relaxation",
  "pain",
  "sleep_quality",
  "physical_ease",
] as const;

export type CheckinItemKey = (typeof CHECKIN_ITEM_KEYS)[number];

export const CHECKIN_ITEMS: Record<
  CheckinItemKey,
  { label: string; low: string; high: string }
> = {
  pain: { label: "Pain", low: "Severe", high: "None" },
  physical_ease: { label: "Physical ease", low: "Stiff", high: "Free" },
  sleep_quality: { label: "Sleep", low: "Poor", high: "Good" },
  // DB key kept as "arousal" for historical rows; presented as Stress.
  arousal: { label: "Stress", low: "Very stressed", high: "Calm" },
  mood: { label: "Mood", low: "Poor", high: "Good" },
  relaxation: { label: "Relaxation", low: "Tense", high: "Relaxed" },
};

/** Fixed display order for the wizard and both check-in phases. */
export const WELLBEING_SCALES: CheckinItemKey[] = [
  "pain",
  "physical_ease",
  "sleep_quality",
  "arousal",
  "mood",
  "relaxation",
];

export type CheckinPhase = "before" | "after";

export type CheckinRatings = Partial<Record<CheckinItemKey, number | null>>;

export interface CheckinRow extends CheckinRatings {
  id: string;
  session_id: string;
  client_id: string;
  phase: CheckinPhase;
  created_at: string;
}

/**
 * Slider thumb colour: red at 0 (worst), white at 5 (neutral), green at 10 (best).
 * Used only for the handle (circle), not the track line.
 */
export function wellbeingThumbColor(value: number): string {
  const t = Math.max(0, Math.min(10, value)) / 10;
  // 0 = red, 0.5 = white, 1 = green
  if (t <= 0.5) {
    const p = t / 0.5; // 0 → 1
    const sat = 75 * (1 - p);
    const light = 42 + 58 * p;
    return `hsl(0 ${sat}% ${light}%)`;
  } else {
    const p = (t - 0.5) / 0.5; // 0 → 1
    const hue = 120 * p;
    const sat = 75 * p;
    const light = 100 - 58 * p;
    return `hsl(${hue} ${sat}% ${light}%)`;
  }
}

/**
 * Value-label colour: red at 0 (worst) through amber to green at 10 (best).
 * Because every scale is right-positive, one function covers all of them.
 */
export function wellbeingColor(value: number): string {
  const t = Math.max(0, Math.min(10, value)) / 10;
  const hue = Math.round(t * 120); // 0 = red, 60 = amber, 120 = green
  return `hsl(${hue} 75% 42%)`;
}


export const CHECKIN_CAPTION =
  "A simple record of how the client felt before and after. It reflects their experience, not a medical measurement.";
