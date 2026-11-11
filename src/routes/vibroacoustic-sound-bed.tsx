import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoWhite from "@/assets/resonabed-logo-white.svg";
import logoMark from "@/assets/resonabed-logo-mark.svg";
import hero from "@/assets/resonabed-hero-1536-img.webp";
import { KitList } from "@/components/kit-list";
import { ClosingDisclaimer } from "@/components/closing-disclaimer";
import { ArrowRight, Waves } from "lucide-react";
import { getKitPricing } from "@/lib/pricing.functions";
import { applyPricing, money, type KitPricing } from "@/lib/packages";
import { INSTALL_FAQ_ANSWER } from "@/lib/kit-contents";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

// Aimed at people turning a table they already own into a sound bed (cost,
// space, setup, home use). Clinic-focused content lives on /vibroacoustic-therapy-bed.
export const TITLE = "Vibroacoustic Sound Bed Kit for Your Own Table | Resonabed";
const DESCRIPTION =
  "Turn the table you already own into a vibroacoustic sound bed with tactile transducers, an amplifier, headphones and the Resonabed app.";
const URL = "https://resonabed.com/vibroacoustic-sound-bed";

export function soundBedFaqs(pricing: KitPricing): { q: string; a: string }[] {
  const p = pricing.packages;
  return [
    {
      q: "What is a vibroacoustic sound bed?",
      a: "A vibroacoustic sound bed is a treatment table fitted with tactile transducers that transmit low-frequency sound through the body as gentle vibration. The client hears the music and feels it at the same time, which is why sessions are often described as deeply restful.",
    },
    {
      q: "Do I need to buy a whole new sound bed?",
      a: "No. The Resonabed kit converts the massage, chiropractic, osteopathic or other therapeutic treatment table already in your room, so you are not paying for a second table or finding space for one.",
    },
    {
      q: "How long does installation take?",
      a: INSTALL_FAQ_ANSWER,
    },
    {
      q: "What does a sound bed kit cost?",
      a: `Basic is ${money(p.essentials.listCents)} and Pro is ${money(p.pro.listCents)}, both including GST and both fitted to your own table. Pro adds a 10 inch tablet with the Resonabed app. Shipping is quoted separately.`,
    },
    {
      q: "Is music included with the sound bed kit?",
      a: "Yes. The Resonabed app comes with 9 original tracks designed by a sound engineer, each pairing a Solfeggio tone with low-frequency vibration between 25 and 120 Hz, centred around 40 Hz, the most widely studied frequency in vibroacoustic therapy. They are licensed and ready to play, so there is no separate music licence to negotiate.",
    },
    {
      q: "Can a vibroacoustic sound bed be used at home?",
      a: `Yes. Resonabed for Home (${money(p.home.listCents)} including GST) is the personal version: it arrives on a fully fitted therapy table with a 10 inch tablet running the personal Resonabed app, and the music licence for home use carries no ongoing cost. The personal app has no bookings or client records.`,
    },
  ];
}

export const Route = createFileRoute("/vibroacoustic-sound-bed")({
  staticData: { sitemap: true },
  // Prices are read on the server so the first HTML and the FAQ data match the homepage.
  loader: async (): Promise<{ pricing: KitPricing }> => {
    try {
      return { pricing: await getKitPricing() };
    } catch {
      return { pricing: applyPricing([]) };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "product" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      jsonLdScript(breadcrumbJsonLd([{ name: "Vibroacoustic sound bed", path: "/vibroacoustic-sound-bed" }])),
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: soundBedFaqs(loaderData?.pricing ?? applyPricing([])).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    ],
  }),
  component: SoundBedPage,
});

function SoundBedPage() {
  const { pricing } = Route.useLoaderData();
  const faqs = soundBedFaqs(pricing);
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 70% 30%, color-mix(in oklab, var(--brand-violet) 45%, transparent), transparent 65%), radial-gradient(50% 45% at 15% 80%, color-mix(in oklab, var(--brand-indigo) 70%, transparent), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-[560px] w-[560px] opacity-[0.08]"
          style={{
            backgroundImage: `url(${logoMark})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
          }}
        />

        <header className="relative z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 md:px-10 md:py-8">
            <Link to="/" className="flex min-w-0 flex-col items-start">
              <img
                src={logoWhite}
                alt="Resonabed"
                className="h-16 w-auto sm:h-20 md:h-28"
                draggable={false}
              />
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 sm:text-xs">
                Feel. Rest. Restore.
              </span>
            </Link>
            <Link to="/" hash="packages">
              <Button
                variant="outline"
                className="h-10 rounded-full border-white/30 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur hover:bg-white/20 hover:text-white"
              >
                See packages
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-4 md:grid-cols-2 md:gap-8 md:px-10 md:pb-28">
          <div className="flex flex-col justify-center">
            <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white/80 backdrop-blur">
              <Waves className="h-3.5 w-3.5" />
              Vibroacoustic sound bed kit
            </span>
            <h1 className="text-4xl font-light leading-[1.05] tracking-tight md:text-5xl">
              Turn your own table into{" "}
              <br />
              <span className="bg-gradient-to-r from-white to-[color-mix(in_oklab,var(--brand-violet)_60%,white)] bg-clip-text text-transparent">
                a vibroacoustic sound bed
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              The Resonabed kit mounts two tactile transducers under a table you already own and
              drives them from a 100W amplifier, so you hear each track through headphones and feel
              its low-frequency layer as gentle vibration through the tabletop. It fits a sturdy
              timber-base massage, chiropractic, osteopathic or other treatment table, so there is
              no second table to buy. Kits start at {money(pricing.packages.essentials.listCents)}{" "}
              including GST, with shipping quoted separately.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/" hash="packages">
                <Button className="h-12 rounded-full px-7 text-[15px] font-medium">
                  See kit packages
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/" hash="home-package">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-white/25 bg-transparent px-7 text-[15px] font-medium text-white hover:bg-white/10 hover:text-white"
                >
                  For home use
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative flex items-center">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2.5rem] opacity-70 blur-3xl"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--brand-violet) 55%, transparent), transparent 70%)",
              }}
            />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 shadow-2xl">
              <img
                src={hero}
                alt="Client resting on a Resonabed vibroacoustic sound bed"
                className="h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW THE KIT WORKS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            How the kit works
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            From treatment table to sound bed
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            The transducers fix to the underside of the tabletop, where the timber carries their
            vibration to the person lying on it. The amplifier powers them and sets how strongly
            the vibration is felt, and the Resonabed app plays the music and runs the timer.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Tables with a metal or heavily padded structural base do not carry the vibration well.
            If you are unsure about yours, send us a photo before you order.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Running a clinic?{" "}
            <Link
              to="/vibroacoustic-therapy-bed"
              className="underline underline-offset-4 hover:text-brand-indigo"
            >
              See the vibroacoustic therapy bed for clinics
            </Link>
            .
          </p>
        </div>
      </section>

      {/* SPECS / WHAT'S INCLUDED */}
      <section className="bg-brand-tint/40 py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              What's in the kit
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              Everything that makes the table a sound bed
            </h2>
          </div>

          <KitList />
        </div>
      </section>

      {/* WHY CONVERT */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Why convert
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            A sound bed without a second table
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "No extra floor space",
              body: "A dedicated sound bed needs its own room or corner. A converted table adds the service to the room you already treat in.",
            },
            {
              title: "Lower cost to start",
              body: "You pay for the acoustics, the app and the music licence, not for another treatment table you already own.",
            },
            {
              title: "Sell it on its own or as an add-on",
              body: "Offer vibroacoustic sessions as a standalone booking, or add a short session to the end of an existing treatment for an uplift on every visit.",
            },
          ].map((x) => (
            <div key={x.title} className="rounded-2xl border border-border bg-card p-8">
              <h3 className="text-lg font-medium text-brand-indigo">{x.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{x.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RESEARCH SUMMARY */}
      <section className="bg-brand-tint/40 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Research
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Studies on vibroacoustic therapy are early and mostly small, and have looked at
            relaxation, sleep and how people respond to low-frequency vibration through the body.
            A Resonabed sound bed is for relaxation and wellbeing; it is not a medical device.
          </p>
          <Link
            to="/research"
            className="mt-4 inline-flex items-center text-sm font-medium text-brand-violet-strong underline underline-offset-4 hover:text-brand-indigo"
          >
            See the research behind vibroacoustic therapy <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24 md:px-10 md:py-28">
        <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Sound bed questions
        </h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {faqs.map((f) => (
            <div key={f.q} className="py-6">
              <h3 className="text-base font-medium text-brand-indigo">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <ClosingDisclaimer className="mt-12" />
      </section>

      {/* CTA */}
      <section className="bg-brand-ink py-20 text-white md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <h2 className="text-3xl font-light tracking-tight md:text-4xl">
            Ready to turn your table into a sound bed?
          </h2>
          <p className="mt-4 text-white/75">
            Compare the kits that fit your own table, or the Home package on a fitted table.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" hash="packages">
              <Button className="h-12 rounded-full px-7 text-[15px] font-medium">
                See kit packages
              </Button>
            </Link>
            <Link to="/">
              <Button
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-transparent px-7 text-[15px] font-medium text-white hover:bg-white/10 hover:text-white"
              >
                Back to Resonabed
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
