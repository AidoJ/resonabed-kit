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
import { INSTALL_SPEC } from "@/lib/kit-contents";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

// Aimed at clinics (session flow, records, packages). Converting your own table
// at home lives on /vibroacoustic-sound-bed.
export const TITLE = "Vibroacoustic Therapy Bed for Clinics | Resonabed";
const DESCRIPTION =
  "Add vibroacoustic therapy to your clinic: a kit for your treatment table or a fitted bed, with an app for screening, sessions and client records.";
const URL = "https://resonabed.com/vibroacoustic-therapy-bed";

export const SPECS: { label: string; value: string }[] = [
  { label: "Transducers", value: "Two Douk Audio tactile transducers, table-mounted" },
  { label: "Amplifier", value: "100W Nobo Sound amplifier, clean professional power" },
  { label: "Frequencies", value: "9 sound engineer designed tracks: Solfeggio tones over a 25 to 120 Hz vibroacoustic base" },
  { label: "Session length", value: "Typically 20 to 40 minutes, client fully clothed" },
  { label: "App", value: "Intake, frequency selection, playback, timer, records, bookings" },
  { label: "Install", value: INSTALL_SPEC },
];

// `linksTodo` shows a visible marker until the owner supplies the study links;
// the marker is page text only and never goes into the FAQ search data.
export const FAQS: { q: string; a: string; linksTodo?: boolean }[] = [
  {
    q: "What is a vibroacoustic therapy bed?",
    a: "It is a treatment table with tactile transducers mounted underneath, so a client lying on it feels the low-frequency layer of the music as gentle vibration while hearing the track through headphones. In a clinic it becomes a bookable service run from the Resonabed app.",
  },
  {
    q: "Can I convert my existing therapy table instead of buying a bed?",
    a: "Yes. Basic and Pro fit the kit to the sturdy timber-base treatment table already in your clinic, using the included wiring, mounting hardware and setup videos. If your table has a metal or heavily padded base, Platinum supplies a new therapy table with the system already fitted.",
  },
  {
    q: "What conditions is a vibroacoustic therapy bed used for?",
    a: "Early research, mostly small studies, has looked at chronic musculoskeletal pain, fibromyalgia symptoms, stress and anxiety, sleep quality, and muscle tension. Vibroacoustic therapy is intended to complement, not replace, professional medical care.",
    linksTodo: true,
  },
  {
    q: "How long does a vibroacoustic therapy session take?",
    a: "Most sessions run 20 to 40 minutes at a chosen frequency. The client stays fully clothed, and the app handles the timer, the fade out and the session record.",
  },
];

export const Route = createFileRoute("/vibroacoustic-therapy-bed")({
  staticData: { sitemap: true },
  // Prices are read on the server so the first HTML matches the homepage cards.
  loader: async (): Promise<{ pricing: KitPricing }> => {
    try {
      return { pricing: await getKitPricing() };
    } catch {
      return { pricing: applyPricing([]) };
    }
  },
  head: () => ({
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
      jsonLdScript(breadcrumbJsonLd([{ name: "Vibroacoustic therapy bed", path: "/vibroacoustic-therapy-bed" }])),
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    ],
  }),
  component: TherapyBedPage,
});

function TherapyBedPage() {
  const { pricing } = Route.useLoaderData();
  const p = pricing.packages;
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
              For clinics and practitioners
            </span>
            <h1 className="text-4xl font-light leading-[1.05] tracking-tight md:text-5xl">
              Vibroacoustic therapy bed{" "}
              <br />
              <span className="bg-gradient-to-r from-white to-[color-mix(in_oklab,var(--brand-violet)_60%,white)] bg-clip-text text-transparent">
                for your clinic
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Resonabed adds vibroacoustic therapy sessions to your practice, either fitted to a
              treatment table you already use or on a new, fully fitted therapy table. The
              Resonabed app takes each session from client screening and frequency choice through
              timed playback to a saved session record. Choose Basic ({money(p.essentials.listCents)}),
              Pro ({money(p.pro.listCents)}) or Platinum ({money(p.platinum.listCents)}), all
              including GST.
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
                alt="Client resting on a Resonabed vibroacoustic therapy bed"
                className="h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IT ADDS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            In your practice
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            What it adds to your practice
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Each client completes a screening step and safe-use guidance with you before their
            first session. You choose one of the 9 tracks and the app runs the timer. At the end
            the music fades out, a closing recording fades in, and the session is saved to the
            client&rsquo;s record.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Clients can book through your own clinic webpage, and business packages include 100
            DL flyers with your clinic details and a QR code linking to it. A 12-month music
            licence for the tracks is included, renewable after that, with no per-session fees.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Setting up at home or on your own table?{" "}
            <Link
              to="/vibroacoustic-sound-bed"
              className="underline underline-offset-4 hover:text-brand-indigo"
            >
              See the vibroacoustic sound bed kit
            </Link>
            .
          </p>
        </div>
      </section>

      {/* SPECS */}
      <section className="bg-brand-tint/40 py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              Technical specification
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              What turns your table into a therapy bed
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border">
            {SPECS.map((s) => (
              <div key={s.label} className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
                <dt className="text-sm font-medium text-brand-indigo">{s.label}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                  {s.value}
                </dd>
              </div>
            ))}
          </div>

          <KitList />
        </div>
      </section>

      {/* RESEARCH SUMMARY */}
      <section className="mx-auto max-w-3xl px-6 pt-24 md:px-10 md:pt-28">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
          Research
        </p>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Published research on vibroacoustic therapy has looked at pain, stress, sleep and
          rehabilitation, and a 2022 BMJ Open scoping review of 20 clinical studies called for
          larger, high-quality trials. For your clients, it is offered as a relaxation therapy, not
          a medical treatment.
        </p>
        <Link
          to="/research"
          className="mt-4 inline-flex items-center text-sm font-medium text-brand-violet-strong underline underline-offset-4 hover:text-brand-indigo"
        >
          See the research behind vibroacoustic therapy <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24 md:px-10 md:py-28">
        <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Vibroacoustic therapy bed questions
        </h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQS.map((f) => (
            <div key={f.q} className="py-6">
              <h3 className="text-base font-medium text-brand-indigo">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.a}
                {f.linksTodo ? <strong className="text-foreground"> [LINKS TODO]</strong> : null}
              </p>
            </div>
          ))}
        </div>
        <ClosingDisclaimer className="mt-12" />
      </section>

      {/* CTA */}
      <section className="bg-brand-ink py-20 text-white md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <h2 className="text-3xl font-light tracking-tight md:text-4xl">
            Ready to add vibroacoustic therapy to your clinic?
          </h2>
          <p className="mt-4 text-white/75">
            Compare Basic, Pro and Platinum side by side on the main site.
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
