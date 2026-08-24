import type { CSSProperties } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BODY_AREA_OPTIONS,
  GOAL_OPTIONS,
  type BodyArea,
  type IntakeGoal,
  type IntakeInputs,
} from "@/lib/frequency-match";
import {
  CHECKIN_ITEMS,
  WELLBEING_SCALES,
  wellbeingColor,
  type CheckinItemKey,
} from "@/lib/checkins";

/**
 * Wellbeing Check step. All six scales are right-positive (right = better).
 * The same answers are saved as the "before" check-in at session creation
 * and repeated afterwards, so wizard wording matches check-in wording.
 */
export interface SymptomsState {
  /** 0 severe → 10 none */
  pain: number;
  /** 0 stiff → 10 free */
  physicalEase: number;
  /** 0 poor → 10 good */
  sleep: number;
  /** 0 very stressed → 10 calm */
  stress: number;
  /** 0 poor → 10 good */
  mood: number;
  /** 0 tense → 10 relaxed */
  relaxation: number;
  bodyAreas: BodyArea[];
  goals: IntakeGoal[];
}

export const DEFAULT_SYMPTOMS: SymptomsState = {
  pain: 5,
  physicalEase: 5,
  sleep: 5,
  stress: 5,
  mood: 5,
  relaxation: 5,
  bodyAreas: [],
  goals: [],
};

/** Which state field each check-in scale reads/writes. */
const SCALE_FIELD: Record<CheckinItemKey, keyof SymptomsState> = {
  pain: "pain",
  physical_ease: "physicalEase",
  sleep_quality: "sleep",
  arousal: "stress",
  mood: "mood",
  relaxation: "relaxation",
};

/**
 * Convert the right-positive wizard scales to the frequency matcher's native
 * semantics. The matcher and historical session rows treat pain/stress as
 * right-WORSE, so they invert here; everything else passes through.
 */
export function toIntakeInputs(s: SymptomsState): IntakeInputs {
  return {
    painLevel: 10 - s.pain,
    stressLevel: 10 - s.stress,
    sleepQuality: s.sleep,
    bodyAreas: s.bodyAreas,
    goals: s.goals,
  };
}

interface Props {
  value: SymptomsState;
  onChange: (s: SymptomsState) => void;
}

const SLIDER_CLASSES =
  "[&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-2";

export function StepSymptoms({ value, onChange }: Props) {
  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-8">
      {WELLBEING_SCALES.map((k) => {
        const meta = CHECKIN_ITEMS[k];
        const field = SCALE_FIELD[k];
        const v = value[field] as number;
        return (
          <div key={k}>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>{meta.label}</Label>
              <span className="text-xs text-muted-foreground">
                {meta.low} → {meta.high}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                className={SLIDER_CLASSES}
                style={{ "--slider-color": wellbeingColor(v) } as CSSProperties}
                min={0}
                max={10}
                step={1}
                value={[v]}
                aria-label={meta.label}
                onValueChange={(nv) => onChange({ ...value, [field]: nv[0] ?? 0 })}
              />
              <div
                className="w-12 text-right text-2xl font-semibold tabular-nums"
                style={{ color: wellbeingColor(v) }}
              >
                {v}
              </div>
            </div>
          </div>
        );
      })}

      <div>
        <Label className="mb-3 block">Body areas of focus</Label>
        <div className="flex flex-wrap gap-2">
          {BODY_AREA_OPTIONS.map((o) => {
            const active = value.bodyAreas.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...value, bodyAreas: toggle(value.bodyAreas, o.value) })}
                className={cn(
                  "h-11 rounded-full border px-4 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Primary goals</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((o) => {
            const active = value.goals.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...value, goals: toggle(value.goals, o.value) })}
                className={cn(
                  "h-11 rounded-full border px-4 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
