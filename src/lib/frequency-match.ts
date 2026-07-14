// Pure scoring: rank the 9 frequencies against intake inputs.
// No side effects, deterministic, unit-testable.

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
}

// Goal affinity per Hz.
const GOAL_WEIGHTS: Record<number, Partial<Record<IntakeGoal, number>>> = {
  174: { relaxation: 3, comfort: 4, stress_relief: 2 },
  285: { recovery: 4, relaxation: 3, comfort: 2 },
  396: { stress_relief: 5, relaxation: 3 },
  417: { stress_relief: 4, relaxation: 3, better_sleep: 1 },
  528: { relaxation: 4, comfort: 3, recovery: 3, energy: 2 },
  639: { comfort: 4, relaxation: 2 },
  741: { energy: 5, recovery: 3 },
  852: { better_sleep: 4, relaxation: 3, stress_relief: 2 },
  963: { better_sleep: 5, relaxation: 4 },
};

// Body-area affinity per Hz (grounding low tones for lower body, higher for upper).
const AREA_WEIGHTS: Record<number, Partial<Record<BodyArea, number>>> = {
  174: { feet: 3, legs: 3, hips: 2, lower_back: 2 },
  285: { lower_back: 2, hips: 2, abdomen: 2 },
  396: { lower_back: 3, hips: 2, upper_back: 2, shoulders: 2 },
  417: { abdomen: 2, chest: 2, shoulders: 1 },
  528: { chest: 3, abdomen: 2, upper_back: 2 },
  639: { chest: 3, shoulders: 2, arms: 2, hands: 2 },
  741: { neck: 3, shoulders: 3, upper_back: 2 },
  852: { head: 3, neck: 2 },
  963: { head: 4, neck: 2 },
};

function sliderContribution(hz: number, i: IntakeInputs): number {
  const pain = i.painLevel;
  const stress = i.stressLevel;
  const sleepDeficit = 10 - i.sleepQuality; // higher = worse sleep

  switch (hz) {
    case 174:
      return pain * 0.6 + stress * 0.2;
    case 285:
      return pain * 0.4 + sleepDeficit * 0.2;
    case 396:
      return stress * 0.7 + pain * 0.3;
    case 417:
      return stress * 0.5;
    case 528:
      return 2 + pain * 0.2; // steady baseline
    case 639:
      return stress * 0.2;
    case 741:
      return Math.max(0, (10 - pain) * 0.2); // energising when pain is low
    case 852:
      return sleepDeficit * 0.5 + stress * 0.3;
    case 963:
      return sleepDeficit * 0.8 + stress * 0.2;
    default:
      return 0;
  }
}

export interface RankedFrequency {
  frequency: FrequencyRow;
  score: number;
}

export function rankFrequencies(
  frequencies: FrequencyRow[],
  intake: IntakeInputs,
): RankedFrequency[] {
  const scored = frequencies.map((f) => {
    const gw = GOAL_WEIGHTS[f.hz] ?? {};
    const aw = AREA_WEIGHTS[f.hz] ?? {};
    let score = sliderContribution(f.hz, intake);
    for (const g of intake.goals) score += gw[g] ?? 0;
    for (const a of intake.bodyAreas) score += aw[a] ?? 0;
    return { frequency: f, score };
  });
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
