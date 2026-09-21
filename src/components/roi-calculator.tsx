import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { money, type PackageDef, type PackageKey } from "@/lib/packages";

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
            <span className={subCls}>Your average price per session</span>
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

type BusinessPackageKey = Extract<PackageKey, "essentials" | "pro" | "platinum">;

export function BusinessRevenueCalculator({
  packages,
}: {
  packages: Record<BusinessPackageKey, PackageDef>;
}) {
  const [selected, setSelected] = useState<BusinessPackageKey>("pro");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(10);
  const [pricePerSession, setPricePerSession] = useState(80);
  const pkg = packages[selected];
  const weeklyRevenueCents = sessionsPerWeek * pricePerSession * 100;
  const weeks = pkg.listCents / weeklyRevenueCents;

  return (
    <section aria-labelledby="revenue-calculator-title" className="mx-auto max-w-4xl px-6 py-20 md:px-10 md:py-24">
      <div className="grid gap-10 border-y border-border py-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">Your numbers</p>
          <h2 id="revenue-calculator-title" className="mt-3 text-3xl font-light text-brand-indigo md:text-4xl">
            Explore your session revenue
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Adjust the sessions you expect to offer and your average price. This estimates gross session revenue, not profit.
          </p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Choose a business package">
            {(["essentials", "pro", "platinum"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={selected === key ? "default" : "outline"}
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
                className="rounded-full"
              >
                {packages[key].label.replace("Resonabed ", "")}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
          <label className="flex items-center justify-between gap-4 text-sm" htmlFor="revenue-sessions">
            <span>Sessions per week</span>
            <strong className="text-brand-indigo">{sessionsPerWeek}</strong>
          </label>
          <input id="revenue-sessions" className="roi-slider mt-2 w-full" type="range" min="1" max="40" value={sessionsPerWeek} onChange={(event) => setSessionsPerWeek(Number(event.target.value))} />
          <label className="mt-5 flex items-center justify-between gap-4 text-sm" htmlFor="revenue-price">
            <span>Your average price per session</span>
            <strong className="text-brand-indigo">${pricePerSession}</strong>
          </label>
          <input id="revenue-price" className="roi-slider mt-2 w-full" type="range" min="40" max="200" step="5" value={pricePerSession} onChange={(event) => setPricePerSession(Number(event.target.value))} />
          <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Estimated gross revenue / week</p><p className="mt-1 text-2xl font-medium text-brand-indigo">{money(weeklyRevenueCents)}</p></div>
            <div><p className="text-xs text-muted-foreground">Package price covered in</p><p className="mt-1 text-2xl font-medium text-brand-indigo">About {Math.ceil(weeks)} weeks</p></div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Illustrative only. Operating costs, tax treatment, utilisation and actual demand affect take-home returns. This is not a guarantee of income.
          </p>
        </div>
      </div>
    </section>
  );
}
