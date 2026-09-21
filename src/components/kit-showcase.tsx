import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { kitImages } from "@/components/kit-card";
import completeKitImage from "@/assets/resonabed-hero-1536-img.webp";
import jblHeadphones from "@/assets/jbl-tune-530-headphones-transparent.png";

const EQUIPMENT = [
  {
    name: "Douk Audio tactile transducers",
    description:
      "Mounted beneath the tabletop to transmit low-frequency vibration through the treatment surface.",
    inclusion: "Included in Basic, Pro and Platinum",
    image: kitImages.transducer,
    imageAlt: "Douk Audio tactile transducer supplied with Resonabed business kits",
    pair: true,
  },
  {
    name: "100W Nobsound amplifier",
    description: "Powers the transducers and controls the vibration level.",
    inclusion: "Included in Basic, Pro and Platinum",
    image: kitImages.amplifier,
    imageAlt: "100W Nobsound amplifier supplied with Resonabed business kits",
  },
  {
    name: "JBL Tune 530 Headphones",
    description:
      "Deliver powerful sound and long-lasting comfort in a lightweight on-ear design, featuring JBL Pure Bass sound.",
    inclusion: "Included in Basic, Pro and Platinum",
    image: jblHeadphones,
    imageAlt: "White JBL Tune 530 on-ear headphones",
  },
  {
    name: '10" IQU tablet',
    description: "Provides access to session selection and playback controls.",
    inclusion: "Included in Pro and Platinum",
    image: kitImages.tablet,
    imageAlt: "10 inch IQU tablet showing the Resonabed session app",
  },
] as const;

export function KitShowcase() {
  return (
    <section aria-labelledby="kit-showcase-title" className="bg-background py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              What’s included in your Resonabed VAT kit
            </p>
            <h2
              id="kit-showcase-title"
              className="mt-3 text-3xl font-light text-brand-indigo md:text-4xl"
            >
              Your kit. Clearly explained.
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
              See the equipment that brings VibroAcoustic Therapy to your treatment room, and
              choose the package that suits your practice.
            </p>
          </div>

          <figure className="overflow-hidden rounded-lg bg-brand-tint/60">
            <img
              src={completeKitImage}
              alt="A client resting on a fully fitted Resonabed treatment table"
              loading="lazy"
              className="aspect-[3/2] w-full object-cover"
            />
            <figcaption className="px-5 py-3 text-xs leading-relaxed text-muted-foreground">
              Fully fitted treatment table shown. The table is included with Platinum and Home;
              Basic and Pro fit a compatible timber-base table you already own.
            </figcaption>
          </figure>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT.map((item) => (
            <article key={item.name} className="flex min-w-0 flex-col border-t border-border pt-5">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-brand-tint/45 p-6">
                {item.image ? (
                  <div className="flex h-full w-full items-center justify-center gap-3">
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                    {"pair" in item && item.pair ? (
                      <img
                        src={item.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="max-h-full max-w-[45%] object-contain"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <h3 className="mt-5 text-lg font-medium text-brand-indigo">{item.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-3 text-xs font-medium text-brand-violet-strong">{item.inclusion}</p>
            </article>
          ))}

          <article className="flex min-w-0 flex-col border-t border-border pt-5">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-brand-tint/45 p-6">
              <img
                src={completeKitImage}
                alt="Fully fitted Resonabed treatment table"
                loading="lazy"
                className="max-h-full max-w-full rounded-md object-contain"
              />
            </div>
            <h3 className="mt-5 text-lg font-medium text-brand-indigo">
              Fully fitted treatment table
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A new treatment table with the Resonabed system fitted and tested before dispatch.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-violet-strong">
              Included in Platinum and Home
            </p>
          </article>
        </div>

        <div className="mt-12 border-y border-brand-violet/20 bg-brand-tint/35 px-5 py-5 md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <h3 className="font-medium text-brand-indigo">Support for getting started</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Every business package includes direct setup guidance, the full business app, a
              bookable clinic webpage, 100 personalised marketing flyers and a 12-month music
              licence. A dedicated tablet and fully fitted table are package upgrades as shown
              above.
            </p>
          </div>
          <div className="mt-5 shrink-0 md:mt-0 md:text-right">
            <p className="mb-3 text-sm font-medium text-brand-indigo">
              Find the right kit for your practice.
            </p>
            <Button asChild className="rounded-full px-6">
              <Link to="/" hash="packages">
                Compare packages
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}