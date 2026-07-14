import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RankedFrequency } from "@/lib/frequency-match";

interface Props {
  ranked: RankedFrequency[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function StepFrequency({ ranked, selectedId, onChange }: Props) {
  if (ranked.length === 0) return null;
  const top = ranked[0]!;
  const rest = ranked.slice(1);
  const selected = ranked.find((r) => r.frequency.id === selectedId) ?? top;

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-xl border p-6"
        style={{
          background: `linear-gradient(135deg, ${selected.frequency.color ?? "#3B4A6B"}22, transparent 70%)`,
          borderColor: selected.frequency.color ?? undefined,
        }}
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Recommended for this intake
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
          <p className="mt-3 text-sm text-muted-foreground">{selected.frequency.description}</p>
        ) : null}
        {selected.frequency.benefits ? (
          <p className="mt-2 text-sm">{selected.frequency.benefits}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Or choose another</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {rest.map((r) => {
            const active = selected.frequency.id === r.frequency.id;
            return (
              <button
                key={r.frequency.id}
                type="button"
                onClick={() => onChange(r.frequency.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary",
                  active && "border-primary bg-primary/5",
                )}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ background: r.frequency.color ?? "#888" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.frequency.hz} Hz · {r.frequency.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.frequency.description}
                  </p>
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
