import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoWhite from "@/assets/resonabed-logo-white.svg";
import logoMark from "@/assets/resonabed-logo-mark.svg";
import hero from "@/assets/resonabed-hero.png.asset.json";
import { ScienceSection } from "@/components/public-clinic/science-section";
import { KitCard, kitImages } from "@/components/kit-card";
import {
  ArrowRight,
  CheckCircle2,
  Speaker,
  Volume2,
  Tablet,
  Music,
  Package,
  Waves,
  Headphones as HeadphonesIcon,
} from "lucide-react";


const TITLE = "Vibroacoustic Sound Bed Kit | Resonabed";
const DESCRIPTION =
  "Turn the therapy table you already own into a professional vibroacoustic sound bed. Tactile transducers, Bluetooth amplifier, session player app and nine Solfeggio frequencies.";
const URL = "https://resonabed.com/vibroacoustic-sound-bed";

export const FAQS: { q: string; a: string }[] = [
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
    a: "The kit arrives with wiring, fittings and a step-by-step guide. Most practitioners have the kit fitted and their first session ready inside an hour.",
  },
  {
    q: "Is music included with the sound bed kit?",
    a: "Yes. Nine wellbeing-focused Solfeggio frequency tracks are licensed and ready to play inside the Resonabed app, so there is no separate music licence to negotiate.",
  },
  {
    q: "Can a vibroacoustic sound bed be used at home?",
    a: "Yes. The same kit is available for personal use, with a simple home version of the app for choosing a frequency and running a timed session.",
  },
];

export const Route = createFileRoute("/vibroacoustic-sound-bed")({
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
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: SoundBedPage,
});

function SoundBedPage() {
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
              A vibroacoustic sound bed,
              <br />
              <span className="bg-gradient-to-r from-white to-[color-mix(in_oklab,var(--brand-violet)_60%,white)] bg-clip-text text-transparent">
                built from the table you already own.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Instead of buying a dedicated sound bed, the Resonabed kit fits tactile transducers,
              a Bluetooth amplifier and a guided session app to your existing massage,
              chiropractic or osteopathic treatment table. The result is a professional-grade
              vibroacoustic sound bed in the room you already work in.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/" hash="packages">
                <Button className="h-12 rounded-full px-7 text-[15px] font-medium">
                  See kit packages
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/" hash="home-use">
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
                src={hero.url}
                alt="Client resting on a Resonabed vibroacoustic sound bed"
                className="h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IT IS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            What it is
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            How a vibroacoustic sound bed works
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A vibroacoustic sound bed carries low-frequency sound directly into the body through
            the surface of the table. Tactile transducers mounted beneath the table convert the
            audio signal into physical vibration, so the client feels the tone as well as hearing
            it. Sessions are typically 20 to 40 minutes, run at a chosen frequency, and the client
            stays fully clothed throughout.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Because the vibration is produced by the table itself, the quality of a sound bed comes
            down to three things: the transducers, the amplifier driving them, and the material
            being played. The Resonabed kit supplies all three, tuned to work together, rather than
            leaving you to source parts and licences separately.
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

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Speaker,
                title: "Two 80W tactile transducers",
                body: "Premium transducers that send low-frequency sound as gentle vibration through your existing table, so clients do not just hear the music, they feel it moving through them.",
                image: kitImages.transducer,
                imageAlt: "Two tactile transducers included in the Resonabed kit",
                pair: true,
              },
              {
                icon: Volume2,
                title: "Bluetooth amplifier",
                body: "Compact wireless amp with clean, professional power. Pair, place and play. No audio engineering and no tangled wiring required.",
                image: kitImages.amplifier,
                imageAlt: "Bluetooth HiFi amplifier included in the Resonabed kit",
              },
              {
                icon: HeadphonesIcon,
                title: "Audio-Technica ATH-M30x professional headphones",
                body: "To complete the experience, every kit includes a pair of Audio-Technica ATH-M30x professional monitor headphones. Where the table delivers sound you feel, these deliver sound you hear in full studio-quality detail, sealing out distraction so your client is held entirely within the session. The same headphones professionals rely on, now part of yours.",
                image: kitImages.headphones,
                imageAlt: "Audio-Technica ATH-M30x professional monitor headphones",
              },
              {
                icon: Tablet,
                title: "Session player and booking app",
                body: "One calm app for client intake, frequency selection, playback, timer, session records and diary bookings. Practitioners pick it up in minutes.",
                image: kitImages.tablet,
                imageAlt: "Resonabed session player app running on a tablet",
              },
              {
                icon: Music,
                title: "9 Solfeggio frequencies",
                body: "Nine therapeutic, wellbeing-focused tones matched to how clients describe what they want. Licensed and ready to play, with no separate music agreement.",
                image: kitImages.solfeggio,
                imageAlt: "Sheet music representing the nine licensed Solfeggio frequency tracks",
              },
              {
                icon: Package,
                title: "Fittings and setup guide",
                body: "Wiring, fittings and a step-by-step guide to install the kit on the massage, chiropractic, osteopathic or other therapeutic table you already own.",
              },
              {
                icon: CheckCircle2,
                title: "Marketing pack",
                body: "Your own customisable booking page plus 100 professionally designed DL flyers carrying your clinic details and a QR code that links straight to it.",
              },
            ].map((item) => (
              <KitCard key={item.title} {...item} />
            ))}
          </div>

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

      <ScienceSection />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24 md:px-10 md:py-28">
        <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Sound bed questions
        </h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQS.map((f) => (
            <div key={f.q} className="py-6">
              <h3 className="text-base font-medium text-brand-indigo">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-ink py-20 text-white md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <h2 className="text-3xl font-light tracking-tight md:text-4xl">
            Ready to turn your table into a sound bed?
          </h2>
          <p className="mt-4 text-white/75">
            Choose the kit that suits your clinic, or read more about Resonabed on the main site.
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
