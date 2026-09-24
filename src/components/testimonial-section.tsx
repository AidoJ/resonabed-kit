import type { Testimonial } from "@/lib/testimonials";

type Props = {
  id?: string;
  title: string;
  items: Testimonial[];
  /** Shown, discreetly, until real quotes are added. */
  emptyNote: string;
  variant?: "site" | "clinic";
  /** Site variant only: tinted band background (alternating sections). */
  tinted?: boolean;
  className?: string;
};

export function TestimonialSection({
  id,
  title,
  items,
  emptyNote,
  variant = "site",
  tinted = false,
  className = "",
}: Props) {
  const clinic = variant === "clinic";

  const eyebrowStyle = clinic
    ? { color: "var(--clinic-accent)" }
    : undefined;
  const eyebrowClass = clinic
    ? ""
    : "text-brand-violet-strong";

  const bodyColor = clinic
    ? { color: "color-mix(in oklab, var(--clinic-ink) 82%, transparent)" }
    : undefined;

  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={
        (tinted ? "bg-secondary/40 " : "") +
        (className || (tinted ? "py-20 md:py-24" : "py-20 md:py-24"))
      }
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className={`text-xs font-medium uppercase tracking-[0.18em] ${eyebrowClass}`}
            style={eyebrowStyle}
          >
            Testimonials
          </p>
          <h2
            id={id ? `${id}-title` : undefined}
            className={
              "mt-3 text-3xl font-light tracking-tight md:text-4xl " +
              (clinic ? "" : "text-brand-indigo")
            }
            style={clinic ? { color: "var(--clinic-ink)" } : undefined}
          >
            {title}
          </h2>
        </div>

        {items.length > 0 ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {items.map((t) => (
              <figure
                key={`${t.name}-${t.quote.slice(0, 24)}`}
                className={
                  "rounded-2xl border p-8 " +
                  (clinic
                    ? ""
                    : "border-border bg-card shadow-soft")
                }
                style={
                  clinic
                    ? {
                        background: "var(--clinic-tint-soft)",
                        borderColor: "color-mix(in oklab, var(--clinic-ink) 12%, transparent)",
                      }
                    : undefined
                }
              >
                <blockquote
                  className={
                    "text-lg font-light leading-relaxed " +
                    (clinic ? "" : "text-foreground/90")
                  }
                  style={bodyColor}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption
                  className={
                    "mt-5 text-sm " + (clinic ? "" : "text-muted-foreground")
                  }
                  style={bodyColor}
                >
                  <span
                    className={clinic ? "font-medium" : "font-medium text-brand-indigo"}
                    style={clinic ? { color: "var(--clinic-ink)" } : undefined}
                  >
                    {t.name}
                  </span>
                  {t.context ? <span> · {t.context}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {emptyNote}
          </p>
        )}
      </div>
    </section>
  );
}
