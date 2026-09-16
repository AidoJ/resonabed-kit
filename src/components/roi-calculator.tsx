import { useMemo, useState } from "react";
import { money } from "@/lib/packages";

/**
 * Interactive payback estimator shown inside each business package card.
 * Simple revenue-only maths: weeks to pay off = kit price / (sessions per
 * week × price per session). Figures are illustrative, not an earnings
 * promise — the disclaimer under the result says so.
 */
export function RoiCalculator({
  listCents,
  highlighted,
}: {
  /** Pay-in-full price of the package, in cents. */
  listCents: number;
  highlighted?: boolean;
}) {
  const [sessionsPerWeek, setSessionsPerWeek] = useState(10);
  const [pricePerSession, setPricePerSession] = useState(80);

  const weeklyRevenueCents = sessionsPerWeek * pricePerSession * 100;
  const weeks = useMemo(() => {
    if (weeklyRevenueCents <= 0) return null;
    return listCents / weeklyRevenueCents;
  }, [listCents, weeklyRevenueCents]);

  const weeksLabel = weeks === null ? "—" : weeks < 1 ? "under a week" : weeks < 1.5 ? "about 1 week" : `about ${Math.ceil(weeks)} weeks`;
  const months = weeks === null ? null : weeks / 4.33;

  const panelCls = highlighted
    ? "border-white/20 bg-white/5 text-white"
    : "border-border bg-brand-tint/50 text-foreground";
  const subCls = highlighted ? "text-white/60" : "text-muted-foreground";
  const strongCls = highlighted ? "text-white" : "text-brand-indigo";

  return (
    <div className={"mt-8 rounded-2xl border px-5 py-4 " + panelCls}>
      <p className={"text-[11px] font-semibold uppercase tracking-[0.14em] " + (highlighted ? "text-white/70" : "text-brand-violet-strong")}>
        Payback estimator
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <label htmlFor={highlighted ? "roi-sessions-h" : undefined} className={subCls}>
              Sessions per week
            </label>
            <span className={"font-semibold tabular-nums " + strongCls}>{sessionsPerWeek}</span>
          </div>
          <input
            type="range"
            min={1}
            max={40}
            step={1}
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
            aria-label="Sessions per week"
            className="roi-slider mt-1.5 w-full"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className={subCls}>Your price per session</span>
            <span className={"font-semibold tabular-nums " + strongCls}>${pricePerSession}</span>
          </div>
          <input
            type="range"
            min={40}
            max={200}
            step={5}
            value={pricePerSession}
            onChange={(e) => setPricePerSession(Number(e.target.value))}
            aria-label="Price per session"
            className="roi-slider mt-1.5 w-full"
          />
        </div>
      </div>

      <div className={"mt-4 border-t pt-3 " + (highlighted ? "border-white/15" : "border-border/70")}>
        <p className="text-sm">
          <span className={subCls}>Weekly revenue: </span>
          <span className={"font-semibold tabular-nums " + strongCls}>
            {money(weeklyRevenueCents)}
          </span>
        </p>
        <p className="mt-1.5 text-sm leading-snug">
          <span className={subCls}>Pays for itself in </span>
          <span className={"text-base font-semibold " + strongCls}>{weeksLabel}</span>
          {months !== null && weeks !== null && weeks >= 4 ? (
            <span className={subCls}> (~{months < 1 ? "1 month" : `${Math.round(months)} months`})</span>
          ) : null}
        </p>
        <p className={"mt-2.5 text-[10.5px] leading-relaxed " + (highlighted ? "text-white/45" : "text-muted-foreground/80")}>
          Illustrative only, based on your own pricing and client numbers. Not a guarantee of
          income.
        </p>
      </div>
    </div>
  );
}
