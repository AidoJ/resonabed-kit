import { useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  CHECKIN_ITEMS,
  WELLBEING_SCALES,
  wellbeingColor,
  wellbeingThumbColor,
  type CheckinItemKey,
  type CheckinPhase,
  type CheckinRatings,
} from "@/lib/checkins";
import { saveSessionCheckin } from "@/lib/checkins.functions";

interface Props {
  sessionId: string;
  phase: CheckinPhase;
  /** Defaults to the fixed six wellbeing scales. */
  items?: CheckinItemKey[];
  /** Pre-fill when re-recording a phase. */
  existing?: CheckinRatings | null;
  onSaved?: () => void;
}

/**
 * The client-facing self-rating screen. Large sliders, pole words at each
 * end, neutral until touched — untouched scales are saved as blank, not as
 * a fake midpoint.
 */
export function CheckinPanel({
  sessionId,
  phase,
  items = WELLBEING_SCALES,
  existing,
  onSaved,
}: Props) {
  const saveFn = useServerFn(saveSessionCheckin);
  const [values, setValues] = useState<Record<CheckinItemKey, number>>(() => {
    const init = {} as Record<CheckinItemKey, number>;
    for (const k of items) init[k] = existing?.[k] ?? 5;
    return init;
  });
  const [touched, setTouched] = useState<Set<CheckinItemKey>>(
    () => new Set(items.filter((k) => existing?.[k] != null)),
  );
  const [busy, setBusy] = useState(false);

  const title = phase === "before" ? "How are you feeling?" : "How are you feeling now?";

  const submit = async () => {
    const ratings: CheckinRatings = {};
    for (const k of items) ratings[k] = touched.has(k) ? values[k] : null;
    if (![...touched].some((k) => items.includes(k))) {
      toast.info("Slide at least one scale, or simply skip this step.");
      return;
    }
    setBusy(true);
    try {
      await saveFn({ data: { session_id: sessionId, phase, ratings } });
      toast.success("Check-in saved");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the check-in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="space-y-1 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {phase === "before" ? "Before the session" : "After the session"}
        </p>
        <h3 className="text-xl font-light">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Optional, slide each scale that applies. Anything left untouched stays blank.
        </p>
      </div>

      <div className="space-y-6">
        {items.map((k) => {
          const meta = CHECKIN_ITEMS[k];
          const isTouched = touched.has(k);
          return (
            <div key={k} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">{meta.label}</p>
                <span
                  className="min-w-8 text-right text-2xl font-extralight tabular-nums text-foreground/90"
                  style={isTouched ? { color: wellbeingColor(values[k]) } : undefined}
                >
                  {isTouched ? values[k] : "–"}
                </span>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[values[k]]}
                aria-label={meta.label}
                className="py-2 [&_[role=slider]]:h-8 [&_[role=slider]]:w-8"
                style={{
                  "--slider-thumb-color": isTouched
                    ? wellbeingThumbColor(values[k])
                    : undefined,
                } as CSSProperties}
                onValueChange={(nv) => {
                  const v = nv[0] ?? 0;
                  setValues((s) => ({ ...s, [k]: v }));
                  setTouched((s) => new Set(s).add(k));
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{meta.low}</span>
                <span>{meta.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Button size="lg" className="h-12 w-full" onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Done"}
      </Button>
    </div>
  );
}
