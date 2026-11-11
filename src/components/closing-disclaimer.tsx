/** Closing disclaimer shared word for word by the science section and both bed pages. */
export const CLOSING_DISCLAIMER =
  "Vibroacoustic therapy is intended to complement, not replace, professional medical care. Individual results may vary, and anyone with significant health concerns should consult their healthcare professional before commencing treatment.";

export function ClosingDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      className={`mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground ${className}`}
    >
      {CLOSING_DISCLAIMER}
    </p>
  );
}
