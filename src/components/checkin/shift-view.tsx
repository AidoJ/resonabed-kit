import {
  CHECKIN_CAPTION,
  CHECKIN_ITEMS,
  CHECKIN_ITEM_KEYS,
  type CheckinRow,
} from "@/lib/checkins";

interface Props {
  before: CheckinRow | null;
  after: CheckinRow | null;
}

/**
 * "Session shift": for each rated scale, before (hollow) and after (solid)
 * markers on a 0–10 line with the movement between them highlighted.
 */
export function CheckinShiftView({ before, after }: Props) {
  if (!before && !after) return null;
  const keys = CHECKIN_ITEM_KEYS.filter((k) => before?.[k] != null || after?.[k] != null);

  return (
    <div className="space-y-5 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Session shift</h2>
        <p className="text-xs text-muted-foreground">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-foreground/60" />
            before
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" />
            after
          </span>
        </p>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">Check-in recorded with no ratings.</p>
      ) : (
        <div className="space-y-5">
          {keys.map((k) => {
            const b = before?.[k] ?? null;
            const a = after?.[k] ?? null;
            const delta = a != null && b != null ? a - b : null;
            const lo = b != null && a != null ? Math.min(b, a) : (b ?? a ?? 0);
            const hi = b != null && a != null ? Math.max(b, a) : (b ?? a ?? 0);
            return (
              <div key={k} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{CHECKIN_ITEMS[k].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {b != null ? b : "–"}
                    {" → "}
                    {a != null ? a : "not recorded"}
                    {delta != null && delta !== 0 ? (
                      <span
                        className={
                          delta > 0
                            ? "ml-2 font-medium text-emerald-600 dark:text-emerald-400"
                            : "ml-2 font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-muted">
                  {b != null && a != null && b !== a ? (
                    <span
                      className={`absolute top-0 h-full rounded-full ${
                        a > b ? "bg-emerald-500/50" : "bg-amber-500/50"
                      }`}
                      style={{ left: `${lo * 10}%`, width: `${(hi - lo) * 10}%` }}
                    />
                  ) : null}
                  {b != null ? (
                    <span
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground/70 bg-background"
                      style={{ left: `${b * 10}%` }}
                    />
                  ) : null}
                  {a != null ? (
                    <span
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                      style={{ left: `${a * 10}%` }}
                    />
                  ) : null}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{CHECKIN_ITEMS[k].low}</span>
                  <span>{CHECKIN_ITEMS[k].high}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!after && before ? (
        <p className="text-xs text-muted-foreground">After check-in not recorded.</p>
      ) : null}
      <p className="border-t pt-3 text-xs text-muted-foreground">{CHECKIN_CAPTION}</p>
    </div>
  );
}
