import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, DollarSign } from "lucide-react";
import { listMyOrgServices } from "@/lib/sessions.functions";
import { cn } from "@/lib/utils";

export interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Props {
  value: ServiceOption | null;
  onChange: (s: ServiceOption) => void;
}

export function StepService({ value, onChange }: Props) {
  const listFn = useServerFn(listMyOrgServices);
  const { data, isLoading } = useQuery({ queryKey: ["services-active"], queryFn: () => listFn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading services…</p>;
  if (!data || data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No active services. Add one from the Services page first.
      </p>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((s) => {
        const selected = value?.id === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s as ServiceOption)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary",
              selected && "border-primary bg-primary/5",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{s.name}</span>
              {selected ? <Check className="h-5 w-5 text-primary" /> : null}
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {s.duration_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> {Number(s.price).toFixed(2)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
