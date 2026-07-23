import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { createKitCheckoutSession } from "@/lib/checkout.functions";
import { EmbeddedCheckoutDialog } from "@/components/embedded-checkout-dialog";
import { PromoStepDialog } from "@/components/promo-step-dialog";
import { ShippingAddressStepDialog, type ShippingContinuePayload, type EnteredShippingAddress } from "@/components/shipping-address-step-dialog";
import logo from "@/assets/resonabed-logo.svg.asset.json";
import logoWhite from "@/assets/resonabed-logo-white.svg";
import hero from "@/assets/resonabed-hero.png.asset.json";
import logoMark from "@/assets/resonabed-logo-mark.svg";

import {
  ArrowRight,
  CheckCircle2,
  Radio,
  Sparkles,
  Waves,
  Clock,
  ShieldCheck,
  Music,
  Tablet,
  ClipboardList,
  Speaker,
  Volume2,
  FileText,
  Heart,
  Zap,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Resonabed — Vibroacoustic upgrade kits for clinics" },
      {
        name: "description",
        content:
          "Turn a bed you already own into a new revenue stream. Resonabed converts your existing massage or therapy bed into a vibroacoustic therapy bed — kit, app, and music licence included.",
      },
      { property: "og:title", content: "Resonabed — Sound you can feel. Rest that goes deeper." },
      {
        property: "og:description",
        content:
          "A passive, high-margin add-on for massage, chiropractic and osteopathic clinics. Fit the kit. Open the app. Add a revenue stream to the room you already work in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const loginHref = signedIn ? "/dashboard" : "/auth";
  const loginLabel = signedIn ? "Open dashboard" : "Clinic login";

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* HERO with integrated dark header */}
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

        {/* NAV */}
        <header className="relative z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6 md:px-10 md:py-8">
            <img
              src={logoWhite}
              alt="Resonabed"
              className="h-32 w-auto md:h-44 lg:h-52 drop-shadow-[0_6px_28px_rgba(136,75,199,0.55)]"
              draggable={false}
            />
            <div className="flex items-center gap-3 md:gap-6">
              <a
                href="#packages"
                className="hidden text-sm font-medium text-white/80 hover:text-white md:inline"
              >
                Packages
              </a>
              <a
                href="#how"
                className="hidden text-sm font-medium text-white/80 hover:text-white md:inline"
              >
                How it works
              </a>
              <Link to={loginHref}>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/30 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur hover:bg-white/20 hover:text-white"
                >
                  {loginLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-8 md:grid-cols-2 md:gap-8 md:px-10 md:pb-28 md:pt-12">

          <div className="flex flex-col justify-center">
            <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white/80 backdrop-blur">
              <Waves className="h-3.5 w-3.5" />
              Vibroacoustic upgrade kits
            </span>
            <h1 className="text-4xl font-light leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Sound you can feel.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[color-mix(in_oklab,var(--brand-violet)_60%,white)]">
                Rest that goes deeper.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Turn a bed you already own into a new source of income. The Resonabed kit converts
              your existing massage, chiropractic or osteopathic bed into a vibroacoustic therapy
              bed — a calm, high-margin session your clients will book again and again.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#packages">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-white/25 bg-transparent px-7 text-[15px] font-medium text-white hover:bg-white/10 hover:text-white"
                >
                  See packages
                </Button>
              </a>
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-4 border-t border-white/10 pt-8 text-left sm:grid-cols-4">
              {[
                { k: "Tactile transducers", v: "Your bed becomes the instrument" },
                { k: "Bluetooth amplifier", v: "Professional power, zero audio stress" },
                { k: "Player + bookings", v: "One calm app for every session" },
                { k: "9 Solfeggio frequencies", v: "Therapeutic tones ready to play" },
              ].map((x) => (
                <div key={x.k}>
                  <dt className="text-xl font-medium tracking-tight">{x.k}</dt>
                  <dd className="mt-1.5 text-xs uppercase tracking-[0.12em] text-white/55">{x.v}</dd>
                </div>
              ))}
            </dl>
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
                alt="Client resting on a Resonabed vibroacoustic therapy bed"
                className="h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Built for practitioners
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            A new revenue stream in the room you already work in.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The kit arrives ready to install: speakers, amplifier, player app and booking tools. Just
            fit it to the bed you already own, open the app, and start offering sessions.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "High-margin add-on",
              body: "The kit turns your existing bed into a revenue stream. Sell it as a standalone session, or add it to the end of a treatment for an easy uplift on every visit.",
            },
            {
              icon: Radio,
              title: "Upgrades the bed you own",
              body: "Two 80W tactile transducers, Bluetooth amp, wiring and fittings. Designed to fit the massage, chiropractic or osteopathic bed already in your room.",
            },
            {
              icon: ClipboardList,
              title: "Guided by the Resonabed app",
              body: "Client intake, tuned frequency selection, timer, playback and session records — one calm tool your practitioners can pick up in minutes.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-medium text-brand-indigo">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT'S IN THE KIT */}
      <section className="py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              What's in the kit
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              Everything you need to turn your bed into a new revenue stream.
            </h2>
            <p className="mt-4 text-muted-foreground">
              No sourcing parts, no music licences, no app subscriptions. The Resonabed kit arrives
              ready to install and ready to sell.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Speaker,
                title: "Tactile transducers",
                body: "Two premium speakers that send low-frequency sound as gentle vibration through your existing bed. Your clients don't just hear the music — they feel it moving through them.",
                cta: "Your bed becomes the instrument",
              },
              {
                icon: Volume2,
                title: "Bluetooth amplifier",
                body: "Compact, wireless amp with clean, professional power. Pair, place, and play. No audio engineering degree and no tangled wiring required.",
                cta: "Plug-and-play power",
              },
              {
                icon: Tablet,
                title: "Session player + booking app",
                body: "One calm app for intake, frequency selection, playback, timer, session records and diary booking. Your practitioners can pick it up in minutes.",
                cta: "Your session command centre",
              },
              {
                icon: Music,
                title: "9 Solfeggio frequencies",
                body: "Nine therapeutic, wellbeing-focused tones matched to feelings your clients will ask for by name. No separate music licence to negotiate.",
                cta: "A library of therapeutic sound",
              },
              {
                icon: FileText,
                title: "250 marketing flyers",
                body: "Professionally designed DL flyers ready to print and display. Start promoting your new session from the day the kit arrives.",
                cta: "Ready-to-print promotion",
              },
              {
                icon: Package,
                title: "Fittings & setup guide",
                body: "Wiring, fittings and a step-by-step guide to install the kit on the massage or therapy bed you already own.",
                cta: "Everything in the box",
              },
            ].map(({ icon: Icon, title, body, cta }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-brand-indigo">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-brand-violet-strong">
                  {cta}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-center gap-4 text-center sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Questions? Email{" "}
              <a href="mailto:info@resonabed.com" className="text-brand-indigo hover:underline">
                info@resonabed.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-secondary/40 py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="grid gap-10 md:grid-cols-2 md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                What a session feels like
              </p>
              <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
                A calm space to unwind — with almost none of your hands-on time.
              </h2>
            </div>
            <p className="text-muted-foreground md:text-right">
              Vibroacoustic therapy delivers low-frequency sound as gentle vibration through the
              bed. Your client doesn't just hear the music — they feel it, softly, moving through
              them as they rest.
            </p>
          </div>

          <ol className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              {
                n: "01",
                title: "Short intake",
                body: "The app screens for a few conditions and guides your practitioner through a two-minute check-in.",
              },
              {
                n: "02",
                title: "Tuned frequency",
                body: "The app selects a low-frequency tone matched to how the client wants to feel.",
              },
              {
                n: "03",
                title: "Experience the session",
                body: "The bed delivers gentle vibration through the speakers while the app manages playback, timer and wake lock.",
              },
              {
                n: "04",
                title: "Close and record",
                body: "One-tap session close with payment logged, ready for next client. Records saved for the clinic.",
              },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl bg-card p-7 shadow-soft">
                <div className="text-xs font-medium tracking-[0.24em] text-brand-violet-strong">
                  {s.n}
                </div>
                <h3 className="mt-3 text-base font-medium text-brand-indigo">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PACKAGES */}
      <section id="packages" className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Two ways to start
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            Choose the package that fits your clinic.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Both packages include the complete kit: tactile speakers, amplifier, Resonabed player
            and booking app, 9 therapeutic Solfeggio frequencies, and 250 professionally designed
            marketing flyers.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <PackageCard
            name="Pro"
            packageKey="pro"
            price="$1,199"
            tagline="The complete upgrade kit."
            description="Everything you need to convert an existing bed. Runs on a tablet, laptop or iPad you already have."
            features={[
              "Two 80W tactile transducers",
              "Bluetooth amplifier with audio jack",
              "Wiring, fittings and setup guide",
              "Resonabed session player + booking app",
              "9 therapeutic Solfeggio frequencies",
              "250 DL marketing flyers, professionally designed",
            ]}
          />
          <PackageCard
            name="Premium"
            packageKey="premium"
            price="$1,399"
            highlighted
            tagline="Pro, plus a dedicated device."
            description={
              'Everything in Pro, plus a 9" Android tablet set up and ready to run the app — so nothing breaks the stillness of a session.'
            }
            features={[
              "Everything included in Pro",
              '9" Android tablet, pre-configured',
              "Kept for sessions only — no notifications, no chimes",
              "Ready to run out of the box",
            ]}
          />
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          You supply your own massage or therapy bed. The kit is designed to upgrade the bed you
          already use.
        </p>
      </section>

      {/* WHY DEDICATED DEVICE */}
      <section className="bg-brand-ink py-24 text-white md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-[1.1fr_1fr] md:items-center md:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
              Why a dedicated device matters
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
              A vibroacoustic session is about uninterrupted calm.
            </h2>
            <p className="mt-5 max-w-xl text-white/70">
              A phone can ring mid-session. A laptop can chime with an email or reminder — and
              those sounds carry straight through the bed to your client. We recommend running
              Resonabed on a device kept just for sessions. The Premium package includes one ready
              to go, so nothing breaks the stillness.
            </p>
            <ul className="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
              {[
                { icon: Tablet, t: "Session-only device" },
                { icon: Music, t: "9 Solfeggio frequencies" },
                { icon: Clock, t: "Screen wake-lock" },
                { icon: ShieldCheck, t: "Encrypted client records" },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-8 rounded-[2rem] opacity-60 blur-3xl"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--brand-violet) 60%, transparent), transparent 70%)",
              }}
            />
            <div className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-10 backdrop-blur">
              <img
                src={logo.url}
                alt=""
                aria-hidden
                className="mx-auto h-24 w-auto opacity-90"
                draggable={false}
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <p className="mt-8 text-center text-lg font-light leading-relaxed text-white/85">
                "The bed does the work while you prepare, reset, or simply give your client time
                to unwind."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24 md:px-10 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-lift md:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--brand-violet) 20%, transparent), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              Ready to add a new revenue stream to your clinic?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Choose the package that fits your clinic, complete checkout, and start offering
              vibroacoustic sessions in the room you already use.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#packages">
                <Button className="h-12 rounded-full px-7 text-[15px] font-medium">
                  Order your kit
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </a>
              <Link to={loginHref}>
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-brand-indigo/20 px-7 text-[15px] font-medium text-brand-indigo hover:bg-brand-tint"
                >
                  {loginLabel}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row md:px-10">
          <img src={logo.url} alt="Resonabed" className="h-8 w-auto" draggable={false} />
          <p className="max-w-2xl text-center text-xs leading-relaxed text-muted-foreground md:text-right">
            Resonabed provides vibroacoustic sessions for relaxation and general wellbeing. It is
            not a medical device or medical treatment and is not intended to diagnose, treat, cure,
            or prevent any medical condition. ·{" "}
            <a href="mailto:info@resonabed.com" className="hover:text-brand-indigo">
              info@resonabed.com
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

const INSTALLMENTS = {
  pro: { deposit: 399, monthly: 100, months: 8 },
  premium: { deposit: 399, monthly: 100, months: 10 },
} as const;

function PackageCard({
  name,
  packageKey,
  price,
  tagline,
  description,
  features,
  highlighted,
}: {
  name: string;
  packageKey: "pro" | "premium";
  price: string;
  tagline: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  const startCheckout = useServerFn(createKitCheckoutSession);
  const [loading, setLoading] = useState<null | "full" | "installments">(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<"full" | "installments">("full");
  const [shippingOpen, setShippingOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<"full" | "installments" | null>(null);
  const [shippingChoice, setShippingChoice] = useState<ShippingContinuePayload | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);

  const plan = INSTALLMENTS[packageKey];
  const totalInstallments = plan.deposit + plan.monthly * plan.months;
  const packagePriceCents = packageKey === "pro" ? 119900 : 139900;

  const runCheckout = async (
    which: "full" | "installments",
    promoCode: string,
    ship: ShippingContinuePayload,
  ) => {
    setLoading(which);
    setActivePlan(which);
    try {
      const address: EnteredShippingAddress | undefined = ship.pickup ? undefined : ship.address;
      const { clientSecret: cs, appliedPromo, shipping } = await startCheckout({
        data: {
          package: packageKey,
          plan: which,
          origin: window.location.origin,
          promoCode: which === "full" ? promoCode : "",
          pickup: ship.pickup,
          shippingAddress: address,
        },
      });
      const shippingBlurb = shipping
        ? shipping.amount === 0
          ? `Pickup — no shipping charge.`
          : `Shipping to ${shipping.label}: $${(shipping.amount / 100).toFixed(2)} AUD${shipping.gstInclusive ? " (incl. GST)" : " (GST-free export)"}.`
        : null;
      const promoBlurb = appliedPromo
        ? `${appliedPromo.code} applied — ${appliedPromo.percentOff}% off, saving $${(appliedPromo.amountDiscounted / 100).toFixed(2)} AUD.`
        : null;
      const combined = [promoBlurb, shippingBlurb].filter(Boolean).join(" ");
      setCheckoutNote(combined || null);
      setClientSecret(cs);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout. Please try again or contact us.");
    } finally {
      setLoading(null);
    }
  };

  const handleOrder = (which: "full" | "installments") => {
    setPendingPlan(which);
    setShippingChoice(null);
    setShippingOpen(true);
  };

  const handleShippingContinue = (payload: ShippingContinuePayload) => {
    setShippingChoice(payload);
    setShippingOpen(false);
    if (pendingPlan === "full") {
      setPromoOpen(true);
    } else if (pendingPlan === "installments") {
      void runCheckout("installments", "", payload);
    }
  };

  return (
    <div
      className={
        "relative overflow-hidden rounded-3xl border p-9 md:p-10 " +
        (highlighted
          ? "border-transparent bg-brand-ink text-white shadow-lift"
          : "border-border bg-card text-foreground shadow-soft")
      }
    >
      {highlighted ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(70% 60% at 100% 0%, color-mix(in oklab, var(--brand-violet) 55%, transparent), transparent 65%)",
          }}
        />
      ) : null}
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3
            className={
              "text-2xl font-medium tracking-tight " +
              (highlighted ? "text-white" : "text-brand-indigo")
            }
          >
            {name}
          </h3>
          {highlighted ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
              Recommended
            </span>
          ) : null}
        </div>
        <p
          className={
            "mt-2 text-sm " + (highlighted ? "text-white/80" : "text-brand-violet-strong")
          }
        >
          {tagline}
        </p>
        <div className="mt-6 flex items-baseline gap-2">
          <span
            className={
              "text-4xl font-light tracking-tight md:text-5xl " +
              (highlighted ? "text-white" : "text-brand-indigo")
            }
          >
            {price}
          </span>
          <span
            className={
              "text-sm " + (highlighted ? "text-white/60" : "text-muted-foreground")
            }
          >
            AUD · incl. GST
          </span>
        </div>
        <p
          className={
            "mt-1 text-xs " + (highlighted ? "text-white/55" : "text-muted-foreground")
          }
        >
          {packageKey === "pro" ? "$1,090 + $109 GST = $1,199" : "$1,272 + $127 GST = $1,399"}
        </p>
        <p
          className={
            "mt-5 text-sm leading-relaxed " +
            (highlighted ? "text-white/75" : "text-muted-foreground")
          }
        >
          {description}
        </p>
        <ul className="mt-7 space-y-3">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm">
              <CheckCircle2
                className={
                  "mt-0.5 h-4 w-4 shrink-0 " +
                  (highlighted ? "text-white" : "text-brand-violet-strong")
                }
              />
              <span className={highlighted ? "text-white/90" : "text-foreground/90"}>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-9 space-y-3">
          <Button
            onClick={() => handleOrder("full")}
            disabled={loading !== null}
            className={
              "h-11 w-full rounded-full text-[14px] font-medium " +
              (highlighted
                ? "bg-white text-brand-ink hover:bg-white/90"
                : "bg-brand-indigo text-white hover:bg-brand-indigo/90")
            }
          >
            {loading === "full" ? "Preparing checkout…" : `Pay in full — ${price}`}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>

          <Button
            onClick={() => handleOrder("installments")}
            disabled={loading !== null}
            variant="outline"
            className={
              "h-11 w-full rounded-full text-[13px] font-medium " +
              (highlighted
                ? "border-white/30 bg-white/5 text-white hover:bg-white/15"
                : "border-brand-indigo/25 bg-transparent text-brand-indigo hover:bg-brand-tint")
            }
          >
            {loading === "installments"
              ? "Preparing checkout…"
              : `Deposit $${plan.deposit} + ${plan.months} × $${plan.monthly}/mo`}
          </Button>

          <p
            className={
              "text-center text-[11px] leading-relaxed " +
              (highlighted ? "text-white/55" : "text-muted-foreground")
            }
          >
            + shipping, calculated by destination · repayment plan total ${totalInstallments} incl.
            GST · billed monthly, auto-stops after the final payment · promo codes only apply to
            pay-in-full · secure checkout by Stripe
          </p>
        </div>
      </div>

      <EmbeddedCheckoutDialog
        clientSecret={clientSecret}
        onClose={() => {
          setClientSecret(null);
          setCheckoutNote(null);
        }}
        subtitle={checkoutNote}
        title={
          activePlan === "installments"
            ? `${name} — Deposit + monthly plan`
            : `Complete your ${name} order`
        }
      />
      <ShippingAddressStepDialog
        open={shippingOpen}
        packagePriceCents={packagePriceCents}
        onCancel={() => {
          setShippingOpen(false);
          setPendingPlan(null);
        }}
        onContinue={handleShippingContinue}
      />
      <PromoStepDialog
        open={promoOpen}
        packageKey={promoOpen ? packageKey : null}
        packagePrice={price}
        onCancel={() => setPromoOpen(false)}
        onContinue={(code) => {
          setPromoOpen(false);
          if (shippingChoice) void runCheckout("full", code, shippingChoice);
        }}
      />
    </div>
  );
}



