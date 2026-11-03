import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AMBIENCE_LABELS, type AmbienceKind, type VariantAvailability } from "@/lib/audio-variants";

interface Props {
  deepFeel: boolean;
  ambience: boolean;
  onDeepFeelChange: (v: boolean) => void;
  onAmbienceChange: (v: boolean) => void;
  /** Availability for the currently selected frequency, if known. */
  availability?: VariantAvailability | null;
  className?: string;
  dark?: boolean;
}

export function AudioVariantSwitches({
  deepFeel,
  ambience,
  onDeepFeelChange,
  onAmbienceChange,
  availability,
  className,
  dark,
}: Props) {
  const has = (v: string) => !availability || availability.variants.includes(v as never);
  const deepMissing = deepFeel && !has(ambience ? "deep_amb" : "deep");
  const ambMissing = ambience && !has(deepFeel ? "deep_amb" : "original_amb");
  const kind: AmbienceKind | null = availability?.ambience ?? null;

  const row = (
    id: string,
    label: string,
    hint: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    note?: string | null,
  ) => (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3",
        dark && "border-white/10 bg-white/5",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>
        {note ? <span className="mt-1 block text-xs font-medium text-amber-500">{note}</span> : null}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {row(
        "deep-feel",
        "Add Deep Feel",
        "You will feel deeper vibrational effects on the bed",
        deepFeel,
        onDeepFeelChange,
        deepMissing ? "Deep Feel not available for this frequency" : null,
      )}
      {row(
        "ambient-sound",
        "Add Ambient Sound",
        "You will hear natural sounds like waves, wind etc in the background on your headphones",
        ambience,
        onAmbienceChange,
        ambMissing
          ? "Ambient sound not available for this frequency"
          : ambience && kind
            ? `This frequency plays ${AMBIENCE_LABELS[kind]}`
            : null,
      )}
    </div>
  );
}
