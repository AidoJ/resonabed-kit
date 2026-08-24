/**
 * Session Check-In (VAS wellbeing self-ratings).
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
  { label: string; low: string; high: string; defaultOn: boolean }
> = {
  arousal: { label: "Calmness", low: "restless", high: "calm", defaultOn: true },
  mood: { label: "Mood", low: "low", high: "good", defaultOn: true },
  relaxation: { label: "Relaxation", low: "tense", high: "relaxed", defaultOn: true },
  pain: { label: "Pain", low: "severe", high: "none", defaultOn: false },
  sleep_quality: { label: "Recent sleep", low: "poor", high: "good", defaultOn: false },
  physical_ease: { label: "Physical ease", low: "stiff", high: "free", defaultOn: false },
};

export const DEFAULT_CHECKIN_ITEMS: CheckinItemKey[] = CHECKIN_ITEM_KEYS.filter(
  (k) => CHECKIN_ITEMS[k].defaultOn,
);

export type CheckinPhase = "before" | "after";

export type CheckinRatings = Partial<Record<CheckinItemKey, number | null>>;

export interface CheckinRow extends CheckinRatings {
  id: string;
  session_id: string;
  client_id: string;
  phase: CheckinPhase;
  created_at: string;
}

export const CHECKIN_CAPTION =
  "A simple record of how the client felt before and after. It reflects their experience, not a medical measurement.";
