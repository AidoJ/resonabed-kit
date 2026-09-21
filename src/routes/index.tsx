import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { createKitCheckoutSession, requestKitEftInvoice } from "@/lib/checkout.functions";
import { sendContactFormEmail, getContactCaptcha } from "@/lib/emails.functions";
import { EmbeddedCheckoutDialog } from "@/components/embedded-checkout-dialog";
import { PromoStepDialog } from "@/components/promo-step-dialog";
import {
  PaymentMethodStepDialog,
  EftInvoiceDialog,
  type EftInvoiceResult,
  type EftContactDetails,
} from "@/components/payment-method-step-dialog";
import {
  ShippingAddressStepDialog,
  type ShippingContinuePayload,
  type EnteredShippingAddress,
} from "@/components/shipping-address-step-dialog";
import {
  BuyerTypeStepDialog,
  type BuyerTypeContinuePayload,
} from "@/components/buyer-type-step-dialog";
import logo from "@/assets/resonabed-logo.svg.asset.json";
import logoWhite from "@/assets/resonabed-logo-white.svg";
import { HeroVideo, heroPosterUrl } from "@/components/hero-video";
import logoMark from "@/assets/resonabed-logo-mark.svg";
import { BusinessRevenueCalculator } from "@/components/roi-calculator";
import {
  ORDER_DEPOSIT_CENTS,
  PACKAGES,
  money,
  planTotalCents,
  type PackageDef,
} from "@/lib/packages";
import { getKitPricing } from "@/lib/pricing.functions";

import {
  ArrowRight,
  CheckCircle2,
  Waves,
  Tablet,
  ClipboardList,
  BedSingle,
  MapPin,
  Mail,
  Phone,
  Send,
  Menu,
  X,
} from "lucide-react";

const NAV_LINKS: { href: string; label: string; children?: { href: string; label: string }[] }[] = [
  { href: "#how", label: "How it works" },
  { href: "#packages", label: "Packages", children: [{ href: "#compare", label: "Compare" }] },
  { href: "/research", label: "Research" },
  { href: "/for-home", label: "For home" },
  { href: "#contact", label: "Contact" },
];

const COMPARE_ROWS: [string, boolean, boolean, boolean, boolean][] = [
  ["Tactile speakers", true, true, true, true],
  ["Amplifier", true, true, true, true],
  ['10" tablet', false, true, true, true],
  ["Headphones", true, true, true, true],
  ["100 disposable headphone covers", false, true, true, false],
  ["100 marketing flyers", true, true, true, false],
  ["Full business app", true, true, true, false],
  ["Full business webpage", true, true, true, false],
  ["Home use app", false, false, false, true],
  ["9 Solfeggio frequencies", true, true, true, true],
  ["Fully fitted out table", false, false, true, true],
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is the difference between Basic, Pro and Platinum?",
    a: "Basic uses your compatible timber-base table and device. Pro adds a dedicated 10 inch tablet and 100 headphone covers. Platinum adds a new therapy table with the system already fitted. Headphones, the business app, clinic webpage and marketing material are included with all three.",
  },
  {
    q: "Can I run a clinic on the Home package?",
    a: "No. Home includes the personal app only. It has no bookings, no client records and no clinic webpage, and it does not include the consumables or flyers a practice needs.",
  },
  {
    q: "Is shipping included?",
    a: "No. Shipping is quoted when you reserve your package, then charged with the balance rather than with the initial deposit.",
  },
  {
    q: "Do I need my own device or table?",
    a: "It depends on the package. Basic runs on a phone, tablet or laptop you already own, and fits to the treatment table you already use. Pro includes a dedicated 10 inch tablet, pre-configured to run sessions and nothing else, and also fits your existing table. Platinum and Home include both the tablet and a fully fitted out table, so nothing else is needed.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resonabed | Vibroacoustic Therapy for Your Practice" },
      {
        name: "description",
        content:
          "Offer your clients deep relaxation they can feel. Resonabed is a complete vibroacoustic therapy system — therapy table, tactile sound, session software and booking, ready to add to your practice.",
      },
      { property: "og:title", content: "Resonabed | Vibroacoustic Therapy for Your Practice" },
      {
        property: "og:description",
        content:
          "Offer your clients deep relaxation they can feel. Resonabed is a complete vibroacoustic therapy system — therapy table, tactile sound, session software and booking, ready to add to your practice.",
      },
      { name: "twitter:title", content: "Resonabed | Vibroacoustic Therapy for Your Practice" },
      {
        name: "twitter:description",
        content:
          "Offer your clients deep relaxation they can feel. Resonabed is a complete vibroacoustic therapy system — therapy table, tactile sound, session software and booking, ready to add to your practice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        as: "image",
        href: heroPosterUrl,
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMobileDemo, setShowMobileDemo] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Super-admin editable kit pricing; static defaults render until this lands.
  const fetchPricing = useServerFn(getKitPricing);
  const { data: pricing } = useQuery({
    queryKey: ["kit-pricing"],
    queryFn: () => fetchPricing(),
    staleTime: 5 * 60_000,
  });
  const pkgs = pricing?.packages ?? PACKAGES;
  const orderDepositCents = pricing?.depositCents ?? ORDER_DEPOSIT_CENTS;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileDemo(!entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Scroll to the #hash target on first load (external links, email links).
  // Images/fonts settling after hydration can shift layout, so re-align a few times.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    };
    const timers = [0, 120, 400, 900].map((ms) => window.setTimeout(go, ms));
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, []);

  const loginHref = signedIn ? "/dashboard" : "/auth";
  const loginLabel = signedIn ? "Open dashboard" : "Clinic login";

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* HERO with integrated dark header */}
      <section ref={heroRef} className="relative overflow-hidden bg-brand-ink text-white">
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
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-6 md:px-10 md:py-7">
            <div className="flex w-fit min-w-0 flex-col items-center">
              <img
                src={logoWhite}
                alt="Resonabed"
                className="h-20 w-auto sm:h-24 md:h-28 lg:h-32 xl:h-44 drop-shadow-[0_6px_28px_rgba(136,75,199,0.55)]"
                draggable={false}
              />
              <p className="mt-1 w-full text-center text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 sm:text-xs md:tracking-[0.35em] md:text-sm">
                Feel. Rest. Restore.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 md:gap-6">
              {NAV_LINKS.map((l) =>
                l.children ? (
                  <div key={l.href} className="group relative hidden lg:block">
                    <a
                      href={l.href}
                      className="text-sm font-medium text-white/80 transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                    <div className="pointer-events-none absolute left-3 top-full z-30 translate-y-1 pt-3 opacity-0 transition duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <div className="flex flex-col items-start gap-1 border-l border-white/20 pl-3">
                        {l.children.map((c) => (
                          <a
                            key={c.href}
                            href={c.href}
                            className="whitespace-nowrap text-sm font-medium text-white/70 transition-colors hover:text-white"
                          >
                            {c.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    className="hidden text-sm font-medium text-white/80 hover:text-white lg:inline"
                  >
                    {l.label}
                  </a>
                ),
              )}

              <Button
                type="button"
                onClick={openCalendlyPopup}
                className="hidden h-10 rounded-full bg-white px-5 text-sm font-medium text-brand-indigo hover:bg-white/90 lg:inline-flex"
              >
                Book a demo
              </Button>

              <Link to={loginHref} className="hidden sm:block">
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/30 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur hover:bg-white/20 hover:text-white"
                >
                  {loginLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur lg:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="mx-6 mb-4 rounded-2xl border border-white/15 bg-brand-ink/95 p-2 backdrop-blur lg:hidden md:mx-10">
              <nav className="flex flex-col">
                {NAV_LINKS.map((l) => (
                  <div key={l.href} className="flex flex-col">
                    <a
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl px-4 py-3 text-[15px] font-medium text-white/85 hover:bg-white/10 hover:text-white"
                    >
                      {l.label}
                    </a>
                    {l.children?.map((c) => (
                      <a
                        key={c.href}
                        href={c.href}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl px-8 py-2.5 text-[14px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                ))}

                <Link
                  to={loginHref}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-[15px] font-medium text-white/85 hover:bg-white/10 hover:text-white sm:hidden"
                >
                  {loginLabel}
                </Link>
              </nav>
            </div>
          )}
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-8 md:px-10 md:pb-28 md:pt-12 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col justify-center">
            <span className="mb-6 inline-flex w-fit items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/75">
              <Waves className="h-3.5 w-3.5" />
              Vibroacoustic therapy for your practice
            </span>
            <h1 className="max-w-[14ch] text-4xl font-light leading-[1.06] sm:text-5xl lg:text-5xl xl:text-6xl">
              Turn your treatment table into a new service.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Add VibroAcoustic Therapy (VAT) sessions to your practice with Resonabed.
            </p>
            <p className="mt-3 max-w-xl leading-relaxed text-white/70">
              Equipment, session software and booking tools in one complete system.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#packages">
                <Button className="h-12 rounded-full bg-white px-7 text-[15px] font-medium text-brand-indigo hover:bg-white/90">
                  Explore business packages
                </Button>
              </a>
              <Button
                type="button"
                onClick={openCalendlyPopup}
                variant="outline"
                className="h-12 rounded-full border-white/30 bg-transparent px-7 text-[15px] font-medium text-white hover:bg-white/10 hover:text-white"
              >
                Book a free demo
              </Button>
            </div>
            <p className="mt-5 max-w-xl text-sm text-white/65">
              Retrofit a compatible timber-base table, or choose a fully fitted setup.
            </p>
            <Link
              to="/for-home"
              className="mt-4 w-fit text-sm text-white/75 underline underline-offset-4 hover:text-white"
            >
              Looking for Resonabed at home?
            </Link>
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
              <HeroVideo />
            </div>
          </div>
        </div>
      </section>

      {showMobileDemo ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <Button type="button" onClick={openCalendlyPopup} className="h-12 w-full rounded-full">
            Book a free demo
          </Button>
        </div>
      ) : null}

      {/* VALUE PROPS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Built for practitioners
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            A complete new service for your existing treatment room.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Choose a retrofit for your compatible table or a fully fitted setup, then run each
            session through one guided system.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: BedSingle,
              title: "Use the room you already have.",
              body: "Retrofit a compatible timber-base treatment table, or choose a fully fitted table as part of your package.",
            },
            {
              icon: Tablet,
              title: "Run sessions with a guided app.",
              body: "Manage session selection, playback and timing in one place. Screening and safe-use guidance support — never replace — practitioner judgement.",
            },
            {
              icon: ClipboardList,
              title: "Tools to help launch your service.",
              body: "Business packages include a bookable clinic webpage and professionally designed marketing flyers personalised for your practice.",
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

      {/* HOW IT WORKS */}
      <section id="how" className="bg-secondary/40 py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="grid gap-10 md:grid-cols-2 md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
                Three clear steps from setup to session.
              </h2>
            </div>
            <p className="text-muted-foreground md:text-right">
              Vibroacoustic therapy delivers low-frequency sound as gentle vibration through the
              table. Your client doesn't just hear the music, they feel it, softly, moving through
              them as they rest.
            </p>
          </div>

          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Set up your system",
                body: "Fit the tactile transducers beneath a compatible timber-base table in around 1–2 hours, or choose a fully fitted setup.",
              },
              {
                n: "02",
                title: "Choose a session",
                body: "Use the guided app for screening, session selection, playback and timing while retaining practitioner judgement.",
              },
              {
                n: "03",
                title: "Welcome your client.",
                body: "Low-frequency vibration travels through the tabletop-mounted transducers while music plays through the included headphones.",
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
            Three business packages
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            Basic, Pro and Platinum.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every business package includes the tactile speakers, amplifier, headphones, 100
            professionally designed{" "}
            <Link
              to="/flyer"
              className="font-medium text-brand-indigo underline underline-offset-4 hover:text-brand-violet-strong"
            >
              marketing flyers
            </Link>
            , the full business app and your own bookable clinic webpage.
          </p>
          <p className="mt-4 rounded-2xl bg-secondary/60 px-5 py-4 text-sm leading-relaxed text-foreground/90">
            The Resonabed app runs on any phone, tablet or laptop. Basic uses a device you already
            own. Pro and Platinum include a dedicated 10 inch tablet.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <PackageCard
            name="Basic"
            packageKey="essentials"
            pkg={pkgs.essentials}
            depositCents={orderDepositCents}
            tagline="Use your own table and device."
            description="The complete business system, running on the phone, tablet or laptop you already use. Fits the treatment table already in your room."
            features={[
              "Two 50W tactile speakers and Bluetooth amplifier",
              "Audio-Technica ATH-M30x headphones",
              "Full business app and bookable clinic webpage",
              "100 personalised marketing flyers",
              "Runs on your own phone, tablet or laptop",
            ]}
          />
          <PackageCard
            name="Pro"
            packageKey="pro"
            pkg={pkgs.pro}
            depositCents={orderDepositCents}
            highlighted
            tagline="Upgrade your table with a dedicated tablet and headphones."
            description="Everything in Basic, plus the dedicated hardware for a hands-off client experience. Fitted to the treatment table in your room."
            features={[
              "Everything included in Basic",
              '10" tablet, pre-configured for sessions',
              "Audio-Technica ATH-M30x headphones",
              "100 disposable headphone covers",
              "Fits your compatible timber-base table",
            ]}
          />
          <PackageCard
            name="Platinum"
            packageKey="platinum"
            pkg={pkgs.platinum}
            depositCents={orderDepositCents}
            tagline="Start with a fully fitted table."
            description="Everything in Pro, on a new therapy table with the system fully fitted and tested before it ships. A complete business in a box, ready to run from the moment it arrives."
            features={[
              "Everything included in Pro",
              "New therapy table, fully fitted out",
              "Dedicated tablet and headphones",
              "Tested as a complete system before dispatch",
            ]}
          />
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Basic and Pro fit the table you already use. It must have a solid timber base so the
          equipment can be mounted securely. Shipping is quoted when you reserve and charged with
          your balance.
        </p>
      </section>

      {/* COMPARE */}
      <section id="compare" className="bg-secondary/40 py-24 md:py-28">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              Side by side
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              What is in each package.
            </h2>
          </div>
          <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-4 font-medium text-brand-indigo">Included</th>
                  {["Basic", "Pro", "Platinum", "Home"].map((h) => (
                    <th key={h} className="px-5 py-4 text-center font-medium text-brand-indigo">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([label, ess, pro, plat, home]) => (
                  <tr key={label as string} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3.5 text-foreground/90">{label}</td>
                    {[ess, pro, plat, home].map((v, i) => (
                      <td
                        key={i}
                        className={`px-5 py-3.5 text-center ${
                          v ? "text-brand-violet-strong" : "text-muted-foreground/60"
                        }`}
                      >
                        {v ? "Yes" : "No"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <BusinessRevenueCalculator
        packages={{ essentials: pkgs.essentials, pro: pkgs.pro, platinum: pkgs.platinum }}
      />

      {/* PRACTITIONER PERSPECTIVE — factual until approved testimonials are supplied */}
      <section
        aria-labelledby="practitioner-perspective-title"
        className="bg-secondary/40 py-20 md:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[0.8fr_1.2fr] md:items-center md:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              Practitioner perspective
            </p>
            <h2
              id="practitioner-perspective-title"
              className="mt-3 text-3xl font-light text-brand-indigo md:text-4xl"
            >
              See how the system fits into a working practice.
            </h2>
          </div>
          <div className="border-l-2 border-brand-violet pl-6 md:pl-8">
            <p className="text-xl font-light leading-relaxed text-brand-indigo">
              “The table does the work while you prepare, reset, or simply give your client time to
              unwind.”
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              How Resonabed is designed to support a practitioner workflow — not a customer
              testimonial.
            </p>
            <Button
              type="button"
              onClick={openCalendlyPopup}
              variant="outline"
              className="mt-6 rounded-full border-brand-indigo/20 text-brand-indigo"
            >
              See a product walkthrough
            </Button>
          </div>
        </div>
      </section>

      {/* RESEARCH TEASER */}
      <section id="research" className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-24">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              How it works &amp; research
            </p>
            <h2 className="mt-3 text-3xl font-light text-brand-indigo md:text-4xl">
              Sound, vibration and the evidence behind VAT.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Two separate bodies of evidence: laboratory work on how cells sense mechanical
              movement, and small human studies of vibroacoustic therapy. Research has explored VAT
              for pain-related outcomes, but stronger controlled studies are needed, and none of this
              research tested Resonabed.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              For background on the equipment itself, read about our{" "}
              <Link
                to="/vibroacoustic-therapy-bed"
                className="text-brand-violet-strong underline underline-offset-4"
              >
                vibroacoustic therapy bed
              </Link>{" "}
              and{" "}
              <Link
                to="/vibroacoustic-sound-bed"
                className="text-brand-violet-strong underline underline-offset-4"
              >
                vibroacoustic sound bed
              </Link>
              .
            </p>
          </div>
          <Link to="/research">
            <Button
              variant="outline"
              className="rounded-full border-brand-indigo/20 text-brand-indigo"
            >
              Explore the research <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* BOOK A DEMO */}
      <section id="demo" className="mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-28">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Book a demo
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            Feel it for yourself.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Choose an in-person demonstration in Brisbane, the Gold Coast or Sunshine Coast, or an
            online product walkthrough.
          </p>
        </div>

        <div className="mt-10 space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            There is only so much a video or a page can convey about sound you feel through your
            whole body. So we would rather show you.
          </p>
          <p>
            We are based in Brisbane and can easily travel to the Gold Coast and Sunshine Coast for
            in-person demos. If you are outside those areas, we can arrange an online product
            walkthrough over a video call. An online walkthrough demonstrates operation, not the
            physical sensation.
          </p>
          <p>No pressure, no obligation. Just book a demo and experience it today.</p>
        </div>

        <div className="mt-10">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-violet/20 bg-background p-10 shadow-soft">
            <p className="mb-6 text-center text-muted-foreground">
              Choose a time that works for you. Tap the button and pick a slot.
            </p>
            <Button
              onClick={openCalendlyPopup}
              className="h-12 rounded-full bg-brand-violet px-8 text-[15px] font-medium text-white hover:bg-brand-violet-strong"
            >
              Book a free demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24 md:px-10 md:py-28">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
            Questions
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
            Before you choose.
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <summary className="cursor-pointer list-none text-base font-medium text-brand-indigo">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-xs leading-relaxed text-muted-foreground">
          Resonabed is a wellbeing product. It is not a medical device and it is not intended to
          diagnose, treat, cure or prevent any disease. If you have a health condition, speak with a
          qualified health professional before use.
        </p>
      </section>

      {/* CLOSING ACTION */}
      <section className="bg-brand-ink py-20 text-white md:py-24">
        <div className="mx-auto max-w-4xl px-6 text-left md:px-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            A complete new service
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-light md:text-4xl">
            Ready to see Resonabed in your treatment room?
          </h2>
          <p className="mt-4 max-w-xl text-white/70">
            Explore the business packages or book a free, no-obligation demonstration.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#packages">
              <Button className="rounded-full bg-white text-brand-indigo hover:bg-white/90">
                Explore packages
              </Button>
            </a>
            <Button
              type="button"
              onClick={openCalendlyPopup}
              variant="outline"
              className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Book a free demo
            </Button>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="bg-secondary/40 py-24 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                About us
              </p>
              <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
                Making vibroacoustic therapy simple to offer, easy to feel.
              </h2>
            </div>
            <div className="space-y-5 text-muted-foreground">
              <p>
                Resonabed exists to make vibroacoustic therapy simple for practitioners to offer and
                easy for clients to feel. We pair a purpose-built kit that upgrades a treatment
                table you already own with a platform that handles bookings, clients and your own
                branded page, so you can add a genuinely different service without adding
                complexity.
              </p>
              <p>
                And if you would rather start fresh, our Platinum package is a complete business in
                a box: a fully fitted-out new therapy table, the full platform, and everything you
                need to start offering sessions from day one.
              </p>
              <p>
                Based in Scarborough, Queensland, we are focused on one thing: helping wellness
                professionals bring the calming power of sound and vibration to the people they care
                for.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
              Get in touch
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              Have a question about packages, setup, or running sessions?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Send us a message and we will get back to you, usually within one business day.
            </p>
            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-brand-indigo">Resonabed</p>
                  <p className="text-sm text-muted-foreground">Scarborough, Queensland</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-brand-indigo">Email</p>
                  <a
                    href="mailto:info@resonabed.com"
                    className="text-sm text-muted-foreground hover:text-brand-indigo"
                  >
                    info@resonabed.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-violet-strong">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-brand-indigo">Phone</p>
                  <a
                    href="tel:+61494825281"
                    className="text-sm text-muted-foreground hover:text-brand-indigo"
                  >
                    0494 825 281
                  </a>
                </div>
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <ContactForm />
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

function ContactForm() {
  const send = useServerFn(sendContactFormEmail);
  const loadCaptcha = useServerFn(getContactCaptcha);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const refreshCaptcha = async () => {
    try {
      const next = await loadCaptcha();
      setCaptcha(next);
      setCaptchaAnswer("");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void refreshCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name";
    if (!form.email.trim()) {
      nextErrors.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email";
    }
    if (form.phone.trim().length < 6) nextErrors.phone = "Please enter your phone number";
    if (!form.message.trim()) nextErrors.message = "Please enter a message";
    if (!captchaAnswer.trim()) nextErrors.captcha = "Please answer the security check";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      await send({
        data: {
          ...form,
          captchaToken: captcha?.token ?? "",
          captchaAnswer,
          website: honeypot,
        },
      });
      setSent(true);
      setForm({ name: "", email: "", phone: "", message: "" });
      void refreshCaptcha();
      toast.success("Message sent. We will be in touch soon.");
    } catch (err) {
      console.error(err);
      void refreshCaptcha();
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not send your message. Please try again or email us directly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-xl font-medium text-brand-indigo">Message sent</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Thanks for reaching out. We have received your message and will reply as soon as we can.
        </p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            type="text"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={!!errors.name}
            className="rounded-xl"
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={!!errors.email}
            className="rounded-xl"
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input
          id="contact-phone"
          type="tel"
          placeholder="0494 825 281"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          aria-invalid={!!errors.phone}
          className="rounded-xl"
        />
        {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          placeholder="Tell us what you would like to know..."
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={!!errors.message}
          rows={5}
          className="rounded-xl"
        />
        {errors.message ? <p className="text-xs text-destructive">{errors.message}</p> : null}
      </div>

      {/* Honeypot, hidden from real users */}
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-captcha">
          Security check{captcha ? ` · ${captcha.question}` : ""}
        </Label>
        <Input
          id="contact-captcha"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={captcha ? "Type the answer" : "Loading security check..."}
          disabled={!captcha}
          value={captchaAnswer}
          onChange={(e) => {
            setCaptchaAnswer(e.target.value);
            if (errors.captcha) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.captcha;
                return next;
              });
            }
          }}
          aria-invalid={!!errors.captcha}
          aria-describedby="captcha-info"
          className="rounded-xl"
        />
        <p id="captcha-info" className="text-xs text-muted-foreground">
          This quick check helps us stop automated spam so your message reaches a real person.
        </p>
        {errors.captcha ? <p className="text-xs text-destructive">{errors.captcha}</p> : null}
      </div>

      <Button
        type="submit"
        disabled={submitting || !captcha}
        className="h-12 w-full rounded-full text-[15px] font-medium"
      >
        {submitting ? "Sending..." : "Send message"}
        <Send className="ml-1.5 h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Or email us directly at{" "}
        <a href="mailto:info@resonabed.com" className="text-brand-indigo hover:underline">
          info@resonabed.com
        </a>
      </p>
    </form>
  );
}

const CALENDLY_URL =
  "https://calendly.com/d/dz68-qcs-9q3" +
  "?hide_gdpr_banner=1&background_color=faf9fc&text_color=100a2e&primary_color=884bc7";

type CalendlyApi = {
  initPopupWidget: (opts: { url: string }) => void;
};

function getCalendly(): CalendlyApi | undefined {
  return (window as typeof window & { Calendly?: CalendlyApi }).Calendly;
}

let calendlyLoadPromise: Promise<void> | null = null;
function loadCalendly(): Promise<void> {
  if (calendlyLoadPromise) return calendlyLoadPromise;
  calendlyLoadPromise = new Promise((resolve, reject) => {
    if (getCalendly()) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "calendly-widget-script";
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Calendly"));
    document.body.appendChild(script);
  });
  return calendlyLoadPromise;
}

function openCalendlyPopup() {
  loadCalendly()
    .then(() => getCalendly()?.initPopupWidget({ url: CALENDLY_URL }))
    .catch(() => toast.error("Could not load the booking form. Please try again."));
}

type BusinessPackageKey = "essentials" | "pro" | "platinum";

function PackageCard({
  name,
  packageKey,
  pkg,
  depositCents,
  tagline,
  description,
  features,
  highlighted,
}: {
  name: string;
  packageKey: BusinessPackageKey;
  /** Resolved pricing for this package (editable by super admins). */
  pkg: PackageDef;
  depositCents: number;
  tagline: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  const startCheckout = useServerFn(createKitCheckoutSession);
  const requestInvoice = useServerFn(requestKitEftInvoice);
  const [loading, setLoading] = useState<null | "full" | "installments">(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<"full" | "installments" | null>(null);
  const [shippingChoice, setShippingChoice] = useState<ShippingContinuePayload | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [payMethodOpen, setPayMethodOpen] = useState(false);
  const [promoChoice, setPromoChoice] = useState("");
  const [eftSubmitting, setEftSubmitting] = useState(false);
  const [eftResult, setEftResult] = useState<EftInvoiceResult | null>(null);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [buyer, setBuyer] = useState<BuyerTypeContinuePayload | null>(null);

  const pkgDef = pkg;
  const price = money(pkgDef.listCents);
  const deposit = money(depositCents);
  const planTotal = money(planTotalCents(pkgDef, depositCents));
  const packagePriceCents = pkgDef.listCents;

  const runCheckout = async (
    which: "full" | "installments",
    promoCode: string,
    ship: ShippingContinuePayload,
    who: BuyerTypeContinuePayload | null,
  ) => {
    setLoading(which);
    try {
      const address: EnteredShippingAddress | undefined = ship.pickup ? undefined : ship.address;
      const {
        clientSecret: cs,
        appliedPromo,
        shipping,
      } = await startCheckout({
        data: {
          package: packageKey,
          origin: window.location.origin,
          promoCode,
          pickup: ship.pickup,
          shippingAddress: address,
          buyerType: who?.buyerType ?? "personal",
          business: who && who.buyerType === "business" ? who.business : undefined,
        },
      });
      const shippingBlurb = shipping
        ? shipping.amount === 0
          ? `Pickup, no shipping charge.`
          : `Shipping to ${shipping.label}: $${(shipping.amount / 100).toFixed(2)} AUD${shipping.gstInclusive ? " (incl. GST)" : " (GST-free export)"}, locked in and charged with your balance, not today.`
        : null;
      const promoBlurb = appliedPromo
        ? `${appliedPromo.code} applied, ${appliedPromo.percentOff}% off, saving $${(appliedPromo.amountDiscounted / 100).toFixed(2)} AUD.`
        : null;
      const combined = [promoBlurb, shippingBlurb].filter(Boolean).join(" ");
      setCheckoutNote(combined || null);
      setClientSecret(cs);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't start checkout. Please try again or contact us.",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleOrder = (which: "full" | "installments") => {
    setPendingPlan(which);
    setShippingChoice(null);
    setBuyer(null);
    setBuyerOpen(true);
  };

  const handleBuyerContinue = (payload: BuyerTypeContinuePayload) => {
    setBuyer(payload);
    setBuyerOpen(false);
    setShippingOpen(true);
  };

  const handleShippingContinue = (payload: ShippingContinuePayload) => {
    setShippingChoice(payload);
    setShippingOpen(false);
    if (pendingPlan === "full") {
      setPromoOpen(true);
    } else if (pendingPlan === "installments") {
      void runCheckout("installments", "", payload, buyer);
    }
  };

  const handleEftRequest = async (contact: EftContactDetails) => {
    if (!shippingChoice) return;
    setEftSubmitting(true);
    try {
      const result = await requestInvoice({
        data: {
          package: packageKey,
          promoCode: promoChoice,
          customerEmail: contact.email,
          customerPhone: contact.phone,
          pickup: shippingChoice.pickup,
          shippingAddress: shippingChoice.pickup ? undefined : shippingChoice.address,
          customerName: shippingChoice.pickup ? undefined : shippingChoice.address.name,
          buyerType: buyer?.buyerType ?? "personal",
          business: buyer && buyer.buyerType === "business" ? buyer.business : undefined,
        },
      });
      setPayMethodOpen(false);
      setEftResult(result);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't raise your invoice. Please contact us.",
      );
    } finally {
      setEftSubmitting(false);
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
          className={"mt-2 text-sm " + (highlighted ? "text-white/80" : "text-brand-violet-strong")}
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
          <span className={"text-sm " + (highlighted ? "text-white/60" : "text-muted-foreground")}>
            AUD · incl. GST
          </span>
        </div>
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
              <span className={highlighted ? "text-white/90" : "text-foreground/90"}>
                {f.toLowerCase().includes("marketing flyers") ? (
                  <Link
                    to="/flyer"
                    className={
                      "underline underline-offset-4 " +
                      (highlighted ? "hover:text-white" : "hover:text-brand-indigo")
                    }
                  >
                    {f}
                  </Link>
                ) : (
                  f
                )}
              </span>
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
            {loading ? "Preparing checkout…" : `Secure your order, ${deposit} deposit`}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>

          <details
            className={
              "rounded-2xl border px-4 py-3 text-[12px] leading-relaxed " +
              (highlighted
                ? "border-white/20 bg-white/5 text-white/80"
                : "border-border bg-brand-tint/50 text-foreground/80")
            }
          >
            <summary className="cursor-pointer font-medium">Payment plans &amp; delivery</summary>
            <p className="mt-1">
              <span className="font-medium">Pay in full,</span> {money(pkgDef.balanceCents)} once,
              so the kit costs {money(pkgDef.listCents)} incl. GST.
            </p>
            <p className="mt-1">
              <span className="font-medium">Or pay over time,</span>{" "}
              {money(pkgDef.plan.depositBalanceCents)} now and {pkgDef.plan.months} monthly payments
              of {money(pkgDef.plan.monthlyCents)}, a plan total of {planTotal} incl. GST (
              {money(Math.max(0, pkgDef.planListCents - pkgDef.listCents))} more than paying in
              full).
            </p>
            <p className="mt-1">Your shipping quote is added to that balance payment.</p>
          </details>

          <p
            className={
              "text-center text-[11px] leading-relaxed " +
              (highlighted ? "text-white/55" : "text-muted-foreground")
            }
          >
            Today you pay the {deposit} deposit only, which holds your order for 30 days and is
            refundable if you do not go ahead. Shipping is quoted upfront and charged with your
            balance. Nothing ships until the balance clears. Promo codes apply to the balance.
            Secure checkout by Stripe.
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
        title={`${name}, order deposit`}
      />
      <BuyerTypeStepDialog
        open={buyerOpen}
        onOpenChange={setBuyerOpen}
        packageName={name}
        onContinue={handleBuyerContinue}
      />

      <ShippingAddressStepDialog
        open={shippingOpen}
        packagePriceCents={packagePriceCents}
        packageKey={packageKey}
        shippingScope={pkgDef.shippingScope}
        depositCents={depositCents}
        pkg={pkgDef}
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
          setPromoChoice(code);
          setPayMethodOpen(true);
        }}
      />
      <PaymentMethodStepDialog
        open={payMethodOpen}
        price={price}
        submitting={eftSubmitting}
        onCancel={() => setPayMethodOpen(false)}
        onCard={() => {
          setPayMethodOpen(false);
          if (shippingChoice) void runCheckout("full", promoChoice, shippingChoice, buyer);
        }}
        onEft={(contact) => void handleEftRequest(contact)}
      />
      <EftInvoiceDialog result={eftResult} onClose={() => setEftResult(null)} />
    </div>
  );
}
