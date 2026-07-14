// Data-driven frequency scoring. All matching data (tags, affinities) lives on
// the frequencies table; this module never hardcodes per-Hz behaviour.

export type IntakeGoal =
  | "relaxation"
  | "stress_relief"
  | "better_sleep"
  | "comfort"
  | "energy"
  | "recovery";

export type BodyArea =
  | "head"
  | "neck"
  | "shoulders"
  | "upper_back"
  | "lower_back"
  | "hips"
  | "legs"
  | "feet"
  | "arms"
  | "hands"
  | "chest"
  | "abdomen";

export interface IntakeInputs {
  painLevel: number; // 0..10
  stressLevel: number; // 0..10
  sleepQuality: number; // 0..10 (10 = excellent)
  bodyAreas: BodyArea[];
  goals: IntakeGoal[];
}

export interface FrequencyRow {
  id: string;
  hz: number;
  name: string;
  description: string | null;
  benefits: string | null;
  color: string | null;
  goal_tags: string[];
  body_area_tags: string[];
  pain_affinity: number; // 0..5
  stress_affinity: number; // 0..5
  sleep_affinity: number; // 0..5 (suited to poor sleep)
}

export interface RankedFrequency {
  frequency: FrequencyRow;
  score: number;
}

// Tunable weights per contribution channel.
const GOAL_WEIGHT = 3;
const AREA_WEIGHT = 2;
// Sliders are 0..10, affinity is 0..5 → normalise so a max-match on any single
// channel is comparable to a couple of goal/area hits.
const SLIDER_SCALE = 0.2; // affinity(5) * slider(10) * 0.2 = 10

function overlapCount(a: string[] | null | undefined, b: string[]): number {
  if (!a || a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  let n = 0;
  for (const v of b) if (set.has(v)) n++;
  return n;
}

export function scoreFrequency(f: FrequencyRow, i: IntakeInputs): number {
  const goalHits = overlapCount(f.goal_tags, i.goals);
  const areaHits = overlapCount(f.body_area_tags, i.bodyAreas);
  const sleepDeficit = 10 - i.sleepQuality;
  const sliderScore =
    (f.pain_affinity * i.painLevel +
      f.stress_affinity * i.stressLevel +
      f.sleep_affinity * sleepDeficit) *
    SLIDER_SCALE;
  return goalHits * GOAL_WEIGHT + areaHits * AREA_WEIGHT + sliderScore;
}

export function rankFrequencies(
  frequencies: FrequencyRow[],
  intake: IntakeInputs,
): RankedFrequency[] {
  const scored = frequencies.map((f) => ({ frequency: f, score: scoreFrequency(f, intake) }));
  scored.sort((a, b) => b.score - a.score || a.frequency.hz - b.frequency.hz);
  return scored;
}

export const BODY_AREA_OPTIONS: { value: BodyArea; label: string }[] = [
  { value: "head", label: "Head" },
  { value: "neck", label: "Neck" },
  { value: "shoulders", label: "Shoulders" },
  { value: "upper_back", label: "Upper back" },
  { value: "lower_back", label: "Lower back" },
  { value: "hips", label: "Hips" },
  { value: "legs", label: "Legs" },
  { value: "feet", label: "Feet" },
  { value: "arms", label: "Arms" },
  { value: "hands", label: "Hands" },
  { value: "chest", label: "Chest" },
  { value: "abdomen", label: "Abdomen" },
];

export const GOAL_OPTIONS: { value: IntakeGoal; label: string }[] = [
  { value: "relaxation", label: "Relaxation" },
  { value: "stress_relief", label: "Stress relief" },
  { value: "better_sleep", label: "Better sleep" },
  { value: "comfort", label: "Comfort" },
  { value: "energy", label: "Energy" },
  { value: "recovery", label: "Recovery" },
];

export const CONTRAINDICATION_OPTIONS: { value: string; label: string }[] = [
  { value: "pacemaker", label: "Pacemaker or implanted electronic device" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "recent_surgery", label: "Recent surgery" },
  { value: "dvt", label: "DVT or thrombosis" },
  { value: "acute_inflammation", label: "Acute inflammation" },
  { value: "low_blood_pressure", label: "Severe low blood pressure" },
  { value: "epilepsy", label: "Epilepsy" },
];
