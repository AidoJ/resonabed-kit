// Four recordings per frequency, chosen by two independent comfort switches.
export const AUDIO_VARIANTS = ["original", "deep", "original_amb", "deep_amb"] as const;
export type AudioVariant = (typeof AUDIO_VARIANTS)[number];
export type AmbienceKind = "water" | "wind";

export interface VariantAvailability {
  variants: AudioVariant[];
  ambience: AmbienceKind | null;
}

export function variantFor(deepFeel: boolean, ambience: boolean): AudioVariant {
  if (deepFeel) return ambience ? "deep_amb" : "deep";
  return ambience ? "original_amb" : "original";
}

export const VARIANT_LABELS: Record<AudioVariant, string> = {
  original: "Gentle",
  deep: "Deep Feel",
  original_amb: "Gentle with ambient sound",
  deep_amb: "Deep Feel with ambient sound",
};

export const AMBIENCE_LABELS: Record<AmbienceKind, string> = {
  water: "water and ocean sounds",
  wind: "forest wind sounds",
};

/** Build per-frequency availability from audio rows. */
export function buildAvailability(
  rows: { frequency_id: string | null; variant?: string | null; ambience_kind?: string | null }[],
): Record<string, VariantAvailability> {
  const out: Record<string, VariantAvailability> = {};
  for (const r of rows) {
    if (!r.frequency_id) continue;
    const a = (out[r.frequency_id] ??= { variants: [], ambience: null });
    const v = (r.variant ?? "original") as AudioVariant;
    if (!a.variants.includes(v)) a.variants.push(v);
    if (!a.ambience && (r.ambience_kind === "water" || r.ambience_kind === "wind")) {
      a.ambience = r.ambience_kind;
    }
  }
  return out;
}

/** Track choice with fallback to the Gentle version when a variant is missing. */
export function pickTrack<T extends { frequency_id: string | null; variant?: string | null }>(
  tracks: T[],
  frequencyId: string,
  variant: AudioVariant,
): T | null {
  const forFreq = tracks.filter((t) => t.frequency_id === frequencyId);
  return (
    forFreq.find((t) => (t.variant ?? "original") === variant) ??
    forFreq.find((t) => (t.variant ?? "original") === "original") ??
    forFreq[0] ??
    null
  );
}
