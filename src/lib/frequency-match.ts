// Target-Hz frequency matching. The matcher computes a single target Hz from
// the intake inputs (weighted average of goal anchors + slider + body-area
// pulls) and then ranks all DB frequencies by absolute distance from that
// target. Goal-tag overlap is used only as a tiebreak within 10 Hz.

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
}

export interface RankedFrequency {
  frequency: FrequencyRow;
  distance: number;
}

// Anchor Hz per primary goal. Tunable in a single place.
export const ANCHORS: Record<IntakeGoal, number> = {
  relaxation: 432,
  stress_relief: 396,
  better_sleep: 230, // low-weighted toward 174–285 range
  comfort: 285,
  energy: 741,
  recovery: 417,
};

// Per body-area pull applied to the sliders/body-area component of the target.
// Lower-body areas nudge downward, head/neck upward.
const BODY_AREA_HZ: Record<BodyArea, number> = {
  head: 640,
  neck: 600,
  shoulders: 500,
  chest: 470,
  arms: 460,
  hands: 460,
  upper_back: 440,
  abdomen: 400,
  lower_back: 320,
  hips: 300,
  legs: 260,
  feet: 220,
};

// Mid-range fallback if the practitioner picked no goals at all.
const NEUTRAL_HZ = 432;

const GOAL_WEIGHT = 0.6;
const SLIDER_WEIGHT = 0.3;
const AREA_WEIGHT = 0.1;

// Slider contribution: high pain pulls low, high stress pulls mid-range.
// Returns a Hz value in roughly the 200–600 band.
function sliderTargetHz(i: IntakeInputs): number {
  const painPull = 200 + (10 - i.painLevel) * 30; // pain 0 → 500, pain 10 → 200
  const stressPull = 396 + (5 - Math.abs(i.stressLevel - 5)) * 20; // peak near 5 → ~496
  return (painPull + stressPull) / 2;
}

function goalTargetHz(goals: IntakeGoal[]): number {
  if (goals.length === 0) return NEUTRAL_HZ;
  const sum = goals.reduce((acc, g) => acc + ANCHORS[g], 0);
  return sum / goals.length;
}

function bodyAreaTargetHz(areas: BodyArea[]): number {
  if (areas.length === 0) return NEUTRAL_HZ;
  const sum = areas.reduce((acc, a) => acc + BODY_AREA_HZ[a], 0);
  return sum / areas.length;
}

export function computeTargetHz(i: IntakeInputs): number {
  const t =
    goalTargetHz(i.goals) * GOAL_WEIGHT +
    sliderTargetHz(i) * SLIDER_WEIGHT +
    bodyAreaTargetHz(i.bodyAreas) * AREA_WEIGHT;
  return Math.round(t);
}

function overlapCount(a: string[] | null | undefined, b: string[]): number {
  if (!a || a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  let n = 0;
  for (const v of b) if (set.has(v)) n++;
  return n;
}

const TIEBREAK_WINDOW_HZ = 10;

export function rankFrequencies(
  frequencies: FrequencyRow[],
  intake: IntakeInputs,
): RankedFrequency[] {
  const target = computeTargetHz(intake);
  const scored = frequencies.map((f) => ({
    frequency: f,
    distance: Math.abs(f.hz - target),
  }));
  scored.sort((a, b) => {
    // Within a 10 Hz window, prefer more goal-tag overlap; otherwise pure distance.
    if (Math.abs(a.distance - b.distance) <= TIEBREAK_WINDOW_HZ) {
      const ao = overlapCount(a.frequency.goal_tags, intake.goals);
      const bo = overlapCount(b.frequency.goal_tags, intake.goals);
      if (ao !== bo) return bo - ao;
    }
    return a.distance - b.distance || a.frequency.hz - b.frequency.hz;
  });
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
