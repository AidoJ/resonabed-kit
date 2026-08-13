import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Headphones,
  Heart,
  Menu,
  Moon,
  Music,
  Package,
  ShieldCheck,
  Sparkles,
  Speaker,
  Tablet,
  Waves,
  X,
} from "lucide-react";

import logoWhite from "@/assets/resonabed-logo-white.svg";
import { KitCard, kitImages } from "@/components/kit-card";
import { HomeOrderPanel } from "@/components/home-order-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-home")({
  head: () => ({
    meta: [
      { title: "Resonabed for Home | Vibroacoustic Therapy at Home" },
      {
        name: "description",
        content:
          "A fully fitted vibroacoustic therapy table for your own home. Lie down, choose a frequency, and feel the music. $1,599 AUD complete, delivered Australia wide.",
      },
      { property: "og:title", content: "Resonabed for Home | Vibroacoustic Therapy at Home" },
      {
        property: "og:description",
        content:
          "Feel the music, not just hear it. A complete home vibroacoustic therapy table, headphones and personal app for $1,599 AUD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForHomePage,
});

const NAV_LINKS = [
  { href: "#what-it-is", label: "What it is" },
  { href: "#feeling", label: "How it feels" },
  { href: "#app", label: "The app" },
  { href: "#box", label: "What's in the box" },
  { href: "#price", label: "Price" },
  { href: "#faq", label: "Questions" },
];

const FREQUENCIES = [
  { hz: "174 Hz", note: "The deepest, heaviest hum. A good place to start when you ache." },
  { hz: "285 Hz", note: "Low and grounding, like a slow tide under your back." },
  { hz: "396 Hz", note: "Traditionally used for letting go of tension you have been carrying." },
  { hz: "417 Hz", note: "A gentle unsettling, then a settling. Good after a hard day." },
  { hz: "528 Hz", note: "The warm, open one. Many people pick this one every time." },
  { hz: "639 Hz", note: "Softer and rounder, easy company for a quiet evening." },
  { hz: "741 Hz", note: "Brighter, lighter through the chest and shoulders." },
  { hz: "852 Hz", note: "Fine and high, felt more in the body than heard." },
  { hz: "963 Hz", note: "The lightest of the nine, barely there and very still." },
];

const FAQ = [
  {
    q: "Do I need any experience to use it?",
    a: "No. You lie down, pick a length of time and a frequency in the app, put the headphones on and let it play. There is nothing to set up each time.",
  },
  {
    q: "Is it loud? Will it disturb the house?",
    a: "The sound you hear is in your headphones. What the table gives you is vibration, felt rather than heard, so a session at night stays yours.",
  },
  {
    q: "How long is a session?",
    a: "Most people choose 20 to 30 minutes. You can set anything from a few minutes to an hour, and the music fades out gently at the end with a soft chime.",
  },
  {
    q: "Does the licence expire?",
    a: "No. Your personal app licence is perpetual, and the 9 Solfeggio frequencies are yours to keep and use as often as you like.",
  },
  {
    q: "Can more than one person use it?",
    a: "Yes. It is a home product, so family and friends are welcome to use it. It is not set up for charging people for sessions.",
  },
  {
    q: "How does it arrive?",
    a: "The table comes already fitted with the transducers, amplifier and wiring, so it is close to ready when it lands. Shipping is charged on top of the $1,599 and is calculated at checkout by your location, typically $80 to $150.",
  },
];

function ForHomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/for-home" className="flex items-center">
            <img src={logoWhite} alt="Resonabed" className="h-7 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-white/70 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="#price" className="hidden md:block">
              <Button className="h-9 rounded-full bg-white px-5 text-[13px] font-medium text-brand-ink hover:bg-white/90">
                Order yours
              </Button>
            </a>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white md:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-white/10 bg-brand-ink px-5 pb-5 pt-2 md:hidden">
            <nav className="flex flex-col">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-white/10 py-3 text-sm text-white/80"
                >
                  {l.label}
                </a>
              ))}
              <a href="#price" onClick={() => setMenuOpen(false)} className="pt-4">
                <Button className="h-10 w-full rounded-full bg-white text-[13px] font-medium text-brand-ink hover:bg-white/90">
                  Order yours
                </Button>
              </a>
            </nav>
          </div>
        ) : null}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 0%, color-mix(in oklab, var(--brand-violet) 55%, transparent), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
            Resonabed for Home
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-light leading-[1.1] tracking-tight md:text-6xl">
            Feel the music, do not just hear it.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            A therapy table for your own home, fitted with two low frequency speakers you feel
            through your whole body. You lie down, choose a frequency, and let twenty quiet minutes
            do what a long day undid.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#price">
              <Button className="h-11 rounded-full bg-white px-7 text-[14px] font-medium text-brand-ink hover:bg-white/90">
                Order yours, $1,599
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
            <a href="#what-it-is">
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/25 bg-white/5 px-7 text-[14px] font-medium text-white hover:bg-white/15"
              >
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-6 text-xs text-white/55">
            Complete package, shipped Australia wide. Shipping is calculated at checkout based on
            your location, typically $80 to $150. Payment plan available.
          </p>
        </div>
      </section>

      {/* What it is */}
      <section id="what-it-is" className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <h2 className="max-w-3xl text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Sound you can lie down inside
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Two tactile transducers sit under the surface of the table. They do not make sound in the
          room, they turn low frequency music into gentle, even vibration that travels up through
          the table and into you. Your headphones carry the music, your body carries the rest. It
          is the same idea used in wellbeing clinics, made simple enough to keep at home.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Waves,
              title: "Whole body, not just ears",
              body: "The vibration spreads across your back, hips and legs, so the music feels like it is arriving from underneath you.",
            },
            {
              icon: Moon,
              title: "Quiet for everyone else",
              body: "Because the music lives in your headphones, a late session does not wake the house. The table only hums softly.",
            },
            {
              icon: Clock,
              title: "Twenty minutes is enough",
              body: "Set a length, close your eyes, and let the app run it. It fades out on its own so you never have to check a clock.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-8">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-medium text-brand-indigo">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What it's like */}
      <section id="feeling" className="bg-brand-tint/40 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-3xl text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            What a session is like
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "You lie down",
                body: "Shoes off, headphones on, nothing to hold. The table is already set up from the last time.",
              },
              {
                step: "02",
                title: "It begins low",
                body: "The first hum arrives under your shoulders and spreads. Most people breathe out without meaning to.",
              },
              {
                step: "03",
                title: "You stop tracking time",
                body: "Somewhere in the middle you lose the thread of the day. That is the part people come back for.",
              },
              {
                step: "04",
                title: "It fades away",
                body: "The music softens, a small chime sounds, and you get up slowly in your own time.",
              },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                  {s.step}
                </div>
                <h3 className="mt-3 text-lg font-medium text-brand-indigo">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The app */}
      <section id="app" className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              A personal app, and nothing to manage
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Your app is the personal version. It holds your frequencies, your session lengths and
              your player, and that is all. There are no records to fill in, no accounts to
              maintain, nothing kept about your health. You open it, press play, and lie down.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Perpetual licence, no subscription",
                "Nine frequencies ready to play, offline once loaded",
                "Choose a length, watch the countdown, or close your eyes and ignore it",
                "Gentle fade out and a soft chime at the end",
                "Works on the tablet, phone or laptop you already own",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet-strong" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-brand-tint/50 p-8">
            <img
              src={kitImages.tablet}
              alt="The Resonabed session player running on a tablet"
              loading="lazy"
              className="mx-auto max-h-72 w-auto object-contain drop-shadow-[0_16px_30px_rgba(38,16,108,0.22)]"
            />
          </div>
        </div>
      </section>

      {/* Frequencies */}
      <section className="bg-brand-ink py-20 text-white md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-light tracking-tight md:text-4xl">
            The nine Solfeggio frequencies
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
            Nine tones, each with its own weight and texture. There is no right one. Pick the one
            that sounds like what you need tonight, and change your mind tomorrow.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FREQUENCIES.map((f) => (
              <div key={f.hz} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-2 text-lg font-medium">
                  <Music className="h-4 w-4 text-white/60" />
                  {f.hz}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Science and disclaimer */}
      <section className="mx-auto max-w-4xl px-5 py-20 md:py-24">
        <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Why low frequency sound feels the way it does
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Low frequency sound applied through the body is usually called vibroacoustic therapy. It
          has been studied since the 1980s in wellbeing, relaxation and comfort settings, and the
          common thread in the research is simple: steady low tones tend to help people settle,
          slow their breathing and feel more comfortable in their body. The sensation is physical,
          which is part of why it holds your attention so easily.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-brand-tint/50 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-violet-strong" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Resonabed is a wellbeing and relaxation product. It is not a medical device, it does
              not diagnose, treat or cure any condition, and it is not a substitute for medical
              care. If you are pregnant, have a pacemaker or other implanted device, a heart
              condition, epilepsy, a recent injury or surgery, deep vein thrombosis, or any
              condition you are unsure about, please speak with your doctor before using it.
            </p>
          </div>
        </div>
      </section>

      {/* What's in the box */}
      <section id="box" className="bg-brand-tint/40 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            What&rsquo;s in the box
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Everything, together. The table comes already fitted, so there is no building to do.
          </p>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <KitCard
              icon={Speaker}
              title="Two 50W tactile transducers"
              body="Fitted under the table before it ships. They turn the low end of the music into an even, gentle vibration you feel all the way through."
              image={kitImages.transducer}
              imageAlt="Tactile transducer"
              pair
            />
            <KitCard
              icon={Waves}
              title="Bluetooth amplifier and wiring"
              body="The small box that drives it all, already wired in and tuned. Pair your device once and it remembers."
              image={kitImages.amplifier}
              imageAlt="Bluetooth amplifier"
            />
            <KitCard
              icon={Headphones}
              title="Audio-Technica ATH-M30x headphones"
              body="Studio headphones so the music stays clean and close while the table does the rest. Comfortable enough to forget you are wearing them."
              image={kitImages.headphones}
              imageAlt="Audio-Technica ATH-M30x headphones"
            />
            <KitCard
              icon={Tablet}
              title="Your personal app"
              body="The Resonabed player with a perpetual licence, on the device you already use. Choose a frequency, set the time, lie down."
              image={kitImages.tablet}
              imageAlt="Resonabed session player"
            />
            <KitCard
              icon={Music}
              title="Nine Solfeggio frequencies"
              body="The full set, included and yours to keep. No extra purchases, no monthly fee, no library to manage."
              image={kitImages.solfeggio}
              imageAlt="Solfeggio frequencies"
            />
            <KitCard
              icon={Package}
              title="A table that is ready to lie on"
              body="A proper therapy table, fitted, tested and packed. Unbox it, plug it in, pair your device and you are ready."
            />
          </div>
          <p className="mt-10 text-base font-medium text-brand-indigo">
            Ready to enjoy. Set it up, lie down, and begin.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Shipping is calculated at checkout based on your location (typically $80 to $150).
          </p>

        </div>
      </section>

      {/* Price */}
      <section id="price" className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="grid items-start gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              One price, everything included
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              $1,599 AUD, everything above included. Shipping is calculated at checkout based on
              your location (typically $80 to $150). That is the fitted table, the transducers and
              amplifier, the headphones, the personal app with a perpetual licence and all nine
              frequencies. There is nothing else to buy afterwards.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Pay in full by card, spread it over a $799 deposit and eight monthly payments of
               $100, or ask for a bank transfer invoice at checkout. However you pay, your access code is emailed to
              you as soon as the first payment lands, so you can set the app up while the table is
              on its way.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: Sparkles, text: "Perpetual licence, no subscription and no renewals" },
                { icon: Heart, text: "For you, your family and your friends at home" },
                {
                  icon: Package,
                  text: "Shipped Australia wide, freight calculated at checkout by location",
                },
              ].map((r) => (
                <div key={r.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet-strong" />
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
          <HomeOrderPanel />
        </div>
      </section>

      {/* How it works after you order */}
      <section className="bg-brand-tint/40 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            After you order
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Your code arrives by email",
                body: "A one-time access code lands in your inbox once payment goes through. Keep the email, it is all you need.",
              },
              {
                step: "02",
                title: "Set up your app",
                body: "Go to the home sign-up page, enter the code, choose a password, and your personal app is ready. It takes a couple of minutes.",
              },
              {
                step: "03",
                title: "Your table arrives",
                body: "Fitted and tested. Plug it in, pair your device, lie down and press play.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-8">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                  {s.step}
                </div>
                <h3 className="mt-3 text-lg font-medium text-brand-indigo">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Already have a code?{" "}
            <Link
              to="/home/signup"
              className="font-medium text-brand-indigo underline underline-offset-4 hover:text-brand-violet-strong"
            >
              Set up your app here
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 md:py-24">
        <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Questions people ask
        </h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <div key={item.q} className="py-6">
              <h3 className="text-base font-medium text-brand-indigo">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <a href="#price">
            <Button className="h-11 rounded-full bg-brand-indigo px-7 text-[14px] font-medium text-white hover:bg-brand-indigo/90">
              Order yours, $1,599
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-brand-ink py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 md:flex-row md:items-center md:justify-between">
          <div>
            <img src={logoWhite} alt="Resonabed" className="h-6 w-auto" />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-white/55">
              Resonabed is a wellbeing and relaxation product, not a medical device. It does not
              diagnose, treat or cure any condition.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-white/70">
            <Link to="/" className="hover:text-white">
              Resonabed for clinics
            </Link>
            <Link to="/home/signup" className="hover:text-white">
              Set up with a code
            </Link>
            <Link to="/home/login" className="hover:text-white">
              Home app sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
