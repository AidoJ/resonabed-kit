import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BODY_AREA_OPTIONS,
  GOAL_OPTIONS,
  type BodyArea,
  type IntakeGoal,
} from "@/lib/frequency-match";

export interface SymptomsState {
  painLevel: number;
  stressLevel: number;
  sleepQuality: number;
  bodyAreas: BodyArea[];
  goals: IntakeGoal[];
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
      <SliderRow
        label="Pain level"
        hint="0 none · 10 severe"
        value={value.painLevel}
        onChange={(v) => onChange({ ...value, painLevel: v })}
      />
      <SliderRow
        label="Stress level"
        hint="0 calm · 10 very stressed"
        value={value.stressLevel}
        onChange={(v) => onChange({ ...value, stressLevel: v })}
      />
      <SliderRow
        label="Sleep quality"
        hint="0 poor · 10 excellent"
        value={value.sleepQuality}
        onChange={(v) => onChange({ ...value, sleepQuality: v })}
      />

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

function SliderRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-4">
        <Slider
          className={SLIDER_CLASSES}
          min={0}
          max={10}
          step={1}
          value={[value]}
          onValueChange={(v) => onChange(v[0] ?? 0)}
        />
        <div className="w-12 text-right text-2xl font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
