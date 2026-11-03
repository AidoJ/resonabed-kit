import { VARIANT_LABELS, type AudioVariant } from "@/lib/audio-variants";

/** Visible note when the chosen recording is missing and another one plays. */
export function VariantFallbackNote({
  audio,
}: {
  audio?: { requested_variant?: AudioVariant; resolved_variant?: AudioVariant } | null;
}) {
  if (!audio?.requested_variant || !audio.resolved_variant) return null;
  if (audio.requested_variant === audio.resolved_variant) return null;
  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
      {VARIANT_LABELS[audio.requested_variant]} is not available for this frequency. Now playing:{" "}
      {VARIANT_LABELS[audio.resolved_variant]}.
    </p>
  );
}
