import { Check, Music, MusicIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BODY_AREA_OPTIONS,
  GOAL_OPTIONS,
  type FrequencyRow,
  type RankedFrequency,
} from "@/lib/frequency-match";
import { Badge } from "@/components/ui/badge";

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((o) => o.value === value)?.label ?? value;
}

function TagSummary({ frequency, className }: { frequency: FrequencyRow; className?: string }) {
  const goals = (frequency.goal_tags ?? []).map((g) => labelFor(GOAL_OPTIONS, g));
  const areas = (frequency.body_area_tags ?? []).map((b) => labelFor(BODY_AREA_OPTIONS, b));
  if (goals.length === 0 && areas.length === 0) return null;
  return (
    <div className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      This frequency has been associated with
      {goals.length > 0 ? (
        <>
          {" "}these goals: <span className="font-medium text-foreground">{goals.join(", ")}</span>
        </>
      ) : null}
      {goals.length > 0 && areas.length > 0 ? " and" : null}
      {areas.length > 0 ? (
        <>
          {" "}these body areas:{" "}
          <span className="font-medium text-foreground">{areas.join(", ")}</span>
        </>
      ) : null}
      .
    </div>
  );
}

interface Props {
  ranked: RankedFrequency[];
  hasAudio: Record<string, boolean>;
  selectedId: string | null;
  targetHz: number;
  onChange: (id: string) => void;
}

export function StepFrequency({ ranked, hasAudio, selectedId, targetHz, onChange }: Props) {
  if (ranked.length === 0) return null;
  const selected = ranked.find((r) => r.frequency.id === selectedId) ?? ranked[0]!;
  const rest = ranked.filter((r) => r.frequency.id !== selected.frequency.id);
  const selectedHasAudio = hasAudio[selected.frequency.id] ?? false;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Target:</span>{" "}
        <span className="font-semibold tabular-nums">{targetHz} Hz</span>
        <span className="ml-2 text-xs text-muted-foreground">
          Computed from goals, sliders and body areas, closest frequency is recommended.
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border p-6"
        style={{
          background: `linear-gradient(135deg, ${selected.frequency.color ?? "#3B4A6B"}22, transparent 70%)`,
          borderColor: selected.frequency.color ?? undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Recommended for this intake
          </div>
          {selectedHasAudio ? (
            <Badge variant="secondary" className="gap-1">
              <MusicIcon className="h-3 w-3" /> Audio ready
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              No audio uploaded
            </Badge>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span
            className="text-5xl font-bold tabular-nums"
            style={{ color: selected.frequency.color ?? undefined }}
          >
            {selected.frequency.hz}
          </span>
          <span className="text-lg text-muted-foreground">Hz</span>
          <span className="ml-2 text-xl font-medium">{selected.frequency.name}</span>
        </div>
        {selected.frequency.description ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {selected.frequency.description}
          </p>
        ) : null}
        <TagSummary frequency={selected.frequency} className="mt-3" />


      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Or choose another</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {rest.map((r) => {
            const active = selected.frequency.id === r.frequency.id;
            const audio = hasAudio[r.frequency.id] ?? false;
            return (
              <button
                key={r.frequency.id}
                type="button"
                onClick={() => onChange(r.frequency.id)}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary",
                  active && "border-primary bg-primary/5",
                )}
              >
                <span
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
                  style={{ background: r.frequency.color ?? "#888" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {r.frequency.hz} Hz · {r.frequency.name}
                    </p>
                    {audio ? (
                      <Music className="h-3.5 w-3.5 text-primary" aria-label="Audio available" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {r.frequency.benefits || r.frequency.description}
                  </p>
                  <TagSummary frequency={r.frequency} className="mt-2" />
                </div>


                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
