import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CHECKIN_CAPTION,
  CHECKIN_ITEMS,
  CHECKIN_ITEM_KEYS,
  type CheckinItemKey,
  type CheckinRow,
} from "@/lib/checkins";
import { listClientCheckins } from "@/lib/checkins.functions";

type SessionPoint = { date: string; before: CheckinRow | null; after: CheckinRow | null };

/** Per-client trend: one small line chart per rated scale, newest last. */
export function ClientCheckinTrends({ clientId }: { clientId: string }) {
  const fn = useServerFn(listClientCheckins);
  const { data } = useQuery({
    queryKey: ["client-checkins", clientId],
    queryFn: () => fn({ data: { client_id: clientId } }),
  });

  const rows = (data ?? []) as unknown as (CheckinRow & {
    session: { created_at: string } | null;
  })[];
  if (rows.length === 0) return null;

  // Pair phases per session, ordered by session time.
  const bySession = new Map<string, SessionPoint>();
  for (const r of rows) {
    const cur =
      bySession.get(r.session_id) ?? {
        date: r.session?.created_at ?? r.created_at,
        before: null,
        after: null,
      };
    if (r.phase === "before") cur.before = r;
    else cur.after = r;
    bySession.set(r.session_id, cur);
  }
  const sessions = [...bySession.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const keys = CHECKIN_ITEM_KEYS.filter((k) =>
    sessions.some((s) => s.after?.[k] != null || s.before?.[k] != null),
  );
  if (keys.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((k) => (
          <TrendChart key={k} item={k} sessions={sessions} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{CHECKIN_CAPTION}</p>
    </div>
  );
}

function TrendChart({ item, sessions }: { item: CheckinItemKey; sessions: SessionPoint[] }) {
  const W = 280;
  const H = 72;
  const PAD = 10;
  const n = sessions.length;
  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1));
  const y = (v: number) => H - PAD - (v / 10) * (H - 2 * PAD);

  const line = (pick: (s: SessionPoint) => number | null) =>
    sessions
      .map((s, i) => {
        const v = pick(s);
        return v == null ? null : `${x(i)},${y(v)}`;
      })
      .filter(Boolean)
      .join(" ");

  const afterLine = line((s) => s.after?.[item] ?? null);
  const beforeLine = line((s) => s.before?.[item] ?? null);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-sm font-medium">{CHECKIN_ITEMS[item].label}</p>
        <p className="text-[10px] text-muted-foreground">
          {CHECKIN_ITEMS[item].low} → {CHECKIN_ITEMS[item].high}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 5, 10].map((v) => (
          <line
            key={v}
            x1={PAD}
            x2={W - PAD}
            y1={y(v)}
            y2={y(v)}
            className="stroke-muted"
            strokeWidth={v === 5 ? 0.5 : 0.75}
            strokeDasharray={v === 5 ? "3 3" : undefined}
          />
        ))}
        {beforeLine ? (
          <polyline
            points={beforeLine}
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.6}
          />
        ) : null}
        {afterLine ? (
          <polyline
            points={afterLine}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {sessions.map((s, i) => {
          const v = s.after?.[item] ?? null;
          return v == null ? null : (
            <circle key={i} cx={x(i)} cy={y(v)} r={3} className="fill-primary" />
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid line: after each session. Dashed: before. {n} session{n === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
