import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import transducerUrl from "@/assets/kit-transducer.webp";
import amplifierUrl from "@/assets/kit-amplifier.webp";
import tabletUrl from "@/assets/kit-tablet.webp";
import solfeggioUrl from "@/assets/kit-solfeggio.webp";
import headphonesUrl from "@/assets/kit-headphones.webp";
import brochureUrl from "@/assets/kit-brochure.webp";

export const kitImages = {
  transducer: transducerUrl,
  amplifier: amplifierUrl,
  tablet: tabletUrl,
  solfeggio: solfeggioUrl,
  headphones: headphonesUrl,
  brochure: brochureUrl,
};

export type KitItem = {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: string;
  image?: string;
  imageAlt?: string;
  /** Render the image twice, side by side (used for the pair of transducers). */
  pair?: boolean;
  linkTo?: string;
  linkLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function KitCard({
  icon: Icon,
  title,
  body,
  cta,
  image,
  imageAlt,
  pair,
  linkTo,
  linkLabel,
  actionLabel,
  onAction,
}: KitItem) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-8 transition hover:-translate-y-0.5 hover:shadow-lift">
      {image ? (
        <div className="mb-6 flex h-44 items-center justify-center gap-4 rounded-xl bg-brand-tint/60 px-6 py-4">
          <img
            src={image}
            alt={imageAlt ?? title}
            loading="lazy"
            className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_10px_20px_rgba(38,16,108,0.18)]"
            draggable={false}
          />
          {pair ? (
            <img
              src={image}
              alt=""
              aria-hidden
              loading="lazy"
              className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_10px_20px_rgba(38,16,108,0.18)]"
              draggable={false}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-medium text-brand-indigo">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {linkTo ? (
        <Link
          to={linkTo}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-indigo underline underline-offset-4 hover:text-brand-violet-strong"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-indigo underline underline-offset-4 hover:text-brand-violet-strong"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {cta ? (
        <p className="mt-auto pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-brand-violet-strong">
          {cta}
        </p>
      ) : null}
    </div>
  );
}
