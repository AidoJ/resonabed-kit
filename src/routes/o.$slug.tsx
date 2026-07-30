import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Clock, Waves, ArrowRight, ShieldCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPublicOrgPage,
  type PublicOrg,
  type PublicService,
} from "@/lib/public-org.functions";
import { PublicBookingForm } from "@/components/public-booking-form";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { clinicThemeVars } from "@/components/public-clinic/clinic-theme";
import {
  EXPECT_STEPS,
  REASONS,
  SOLFEGGIO,
  QUICK_FACTS,
} from "@/components/public-clinic/clinic-content";
import { StickyBookCta } from "@/components/public-clinic/sticky-book-cta";
import heroWide from "@/assets/resonabed-hero-1536.webp.asset.json";
import heroSmall from "@/assets/resonabed-hero-768.webp.asset.json";

const SITE = "https://resonabed.com";
const HERO_OG = `${SITE}${heroWide.url}`;

async function loadPublicPage(slug: string) {
  const res = await getPublicOrgPage({ data: { slug } });
  if (!res.org) throw notFound();
  return res as { org: PublicOrg; services: PublicService[]; logoUrl: string | null };
}

export const Route = createFileRoute("/o/$slug")({
  loader: ({ params }) => loadPublicPage(params.slug),
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Page not available — Resonabed" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { org } = loaderData;
    const url = `${SITE}/o/${params.slug}`;
    const title = `${org.name} — Vibroacoustic relaxation sessions`;
    const description =
      org.public_blurb?.slice(0, 155) ??
      `Book a Resonabed vibroacoustic relaxation session with ${org.name}. Sound you can feel, rest that goes deeper.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: HERO_OG },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: HERO_OG },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HealthAndBeautyBusiness",
            name: org.name,
            url,
            image: HERO_OG,
            description,
            ...(org.public_contact_phone ? { telephone: org.public_contact_phone } : {}),
            ...(org.public_contact_email ? { email: org.public_contact_email } : {}),
            ...(org.public_suburb
              ? { address: { "@type": "PostalAddress", addressLocality: org.public_suburb } }
              : {}),
          }),
        },
      ],
    };
  },
  component: PublicOrgPage,
  errorComponent: () => <Unavailable />,
  notFoundComponent: () => <Unavailable />,
});

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-light tracking-tight">This page isn&rsquo;t available</h1>
      <p className="mt-2 text-muted-foreground">
        This clinic page doesn&rsquo;t exist, or it hasn&rsquo;t been published yet.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/">Back to Resonabed</Link>
      </Button>
    </main>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}

function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className="text-xs font-medium uppercase tracking-[0.18em]"
      style={onDark ? { color: "color-mix(in oklab, var(--clinic-ink-fg) 65%, transparent)" } : { color: "var(--clinic-accent)" }}
    >
      {children}
    </p>
  );
}

function PublicOrgPage() {
  const data = Route.useLoaderData() as {
    org: PublicOrg;
    services: PublicService[];
    logoUrl: string | null;
  };
  const { org, services, logoUrl } = data;
  const theme = clinicThemeVars(org.theme_sidebar, org.theme_primary);
  const tz = org.timezone || DEFAULT_TIMEZONE;
  const bookable = org.public_booking_enabled && services.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground" style={theme}>
      {/* ---------------------------------------------------------------- HERO */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--clinic-ink)", color: "var(--clinic-ink-fg)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 70% 30%, color-mix(in oklab, var(--clinic-accent) 45%, transparent), transparent 65%), radial-gradient(50% 45% at 15% 80%, color-mix(in oklab, var(--clinic-accent) 30%, transparent), transparent 70%)",
          }}
        />

        <header className="relative z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6 md:px-10 md:py-8">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${org.name} logo`}
                className="h-14 w-auto object-contain md:h-20"
                draggable={false}
              />
            ) : (
              <span className="text-lg font-light tracking-tight">{org.name}</span>
            )}
            {org.public_contact_phone ? (
              <a
                href={`tel:${org.public_contact_phone.replace(/\s+/g, "")}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-current/25 px-5 text-sm font-medium opacity-90 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <Phone className="h-4 w-4" />
                {org.public_contact_phone}
              </a>
            ) : null}
          </div>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-6 md:grid-cols-2 md:gap-10 md:px-10 md:pb-28 md:pt-10">
          <div className="flex flex-col justify-center">
            <span
              className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] backdrop-blur"
              style={{
                borderColor: "color-mix(in oklab, var(--clinic-ink-fg) 18%, transparent)",
                background: "color-mix(in oklab, var(--clinic-ink-fg) 6%, transparent)",
                color: "color-mix(in oklab, var(--clinic-ink-fg) 80%, transparent)",
              }}
            >
              <Waves className="h-3.5 w-3.5" />
              Vibroacoustic therapy
            </span>

            <h1 className="text-4xl font-light leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Sound you can feel.
              <br />
              Rest that goes deeper.
            </h1>

            <p
              className="mt-6 max-w-xl whitespace-pre-line text-lg leading-relaxed"
              style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 78%, transparent)" }}
            >
              {org.public_blurb ??
                `A calm, passive session at ${org.name}. You lie back fully clothed while low-frequency sound moves gently through the body.`}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              {bookable ? (
                <a
                  href="#request"
                  className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
                  style={{
                    background: "var(--clinic-accent)",
                    color: "var(--clinic-accent-fg)",
                  }}
                >
                  Request a booking
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : org.public_contact_phone ? (
                <a
                  href={`tel:${org.public_contact_phone.replace(/\s+/g, "")}`}
                  className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
                  style={{
                    background: "var(--clinic-accent)",
                    color: "var(--clinic-accent-fg)",
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call to book
                </a>
              ) : null}
              <a
                href="#expect"
                className="inline-flex h-12 items-center rounded-full border px-7 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                style={{
                  borderColor: "color-mix(in oklab, var(--clinic-ink-fg) 25%, transparent)",
                  color: "var(--clinic-ink-fg)",
                }}
              >
                What to expect
              </a>
            </div>

            <dl
              className="mt-12 grid grid-cols-1 gap-4 border-t pt-8 text-left sm:grid-cols-3"
              style={{ borderColor: "color-mix(in oklab, var(--clinic-ink-fg) 12%, transparent)" }}
            >
              {QUICK_FACTS.map((x) => (
                <div key={x.k}>
                  <dt className="text-xl font-medium tracking-tight">{x.k}</dt>
                  <dd
                    className="mt-1.5 text-xs uppercase tracking-[0.12em]"
                    style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 55%, transparent)" }}
                  >
                    {x.v}
                  </dd>
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
                  "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--clinic-accent) 50%, transparent), transparent 70%)",
              }}
            />
            <div
              className="relative overflow-hidden rounded-[1.75rem] border shadow-2xl"
              style={{ borderColor: "color-mix(in oklab, var(--clinic-ink-fg) 12%, transparent)" }}
            >
              <picture>
                <source media="(max-width: 767px)" srcSet={heroSmall.url} type="image/webp" />
                <source srcSet={heroWide.url} type="image/webp" />
                <img
                  src={heroWide.url}
                  alt="A client resting on a vibroacoustic therapy bed as sound resonates through it"
                  className="h-auto w-full"
                  width={1536}
                  height={1024}
                  loading="eager"
                  fetchPriority="high"
                  draggable={false}
                />
              </picture>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ WHAT TO EXPECT */}
      <section id="expect" className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>What to expect</Eyebrow>
          <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
            A simple, unhurried hour
          </h2>
          <p className="mt-4 text-muted-foreground">
            Nothing here is difficult and nothing is asked of you. Here&rsquo;s how a session runs.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EXPECT_STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border p-6 transition-shadow motion-reduce:transition-none hover:shadow-lg"
              style={{ background: "var(--clinic-tint-soft)" }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--clinic-accent)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ WHAT IT IS */}
      <section
        className="py-20 md:py-28"
        style={{ background: "var(--clinic-ink)", color: "var(--clinic-ink-fg)" }}
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-6 md:grid-cols-2 md:px-10">
          <div>
            <Eyebrow onDark>What it is</Eyebrow>
            <h2 className="mt-3 text-3xl font-light leading-tight tracking-tight md:text-4xl">
              You don&rsquo;t just hear the music. You feel it.
            </h2>
            <div
              className="mt-6 space-y-5 text-base leading-relaxed"
              style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 75%, transparent)" }}
            >
              <p>
                Vibroacoustic therapy is music felt through the body. Low-frequency sound is played
                through the bed you&rsquo;re lying on, so the tones travel through you as gentle,
                steady vibration rather than sitting in the room around you.
              </p>
              <p>
                It&rsquo;s a very old idea in a modern form. People have used sound, drums and tone
                to settle the body for thousands of years — this is the same instinct, delivered
                precisely and quietly, while you rest.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border p-5"
                style={{
                  borderColor: "color-mix(in oklab, var(--clinic-ink-fg) 14%, transparent)",
                  background: "color-mix(in oklab, var(--clinic-ink-fg) 5%, transparent)",
                }}
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    background: "color-mix(in oklab, var(--clinic-accent) 30%, transparent)",
                  }}
                >
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-medium tracking-tight">{r.title}</h3>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 70%, transparent)" }}
                >
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- FREQUENCIES */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Frequencies</Eyebrow>
          <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
            Tuned to how you feel
          </h2>
          <p className="mt-4 text-muted-foreground">
            Nine tones, each with its own character. Your practitioner chooses the one that suits
            how you&rsquo;re feeling on the day.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOLFEGGIO.map((f) => (
            <div
              key={f.hz}
              className="flex items-center justify-between gap-4 rounded-xl border px-5 py-4"
              style={{ background: "var(--clinic-tint-soft)" }}
            >
              <span className="text-lg font-light tracking-tight">{f.hz}</span>
              <span className="text-right text-sm text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Not sure which one is right for you? You don&rsquo;t need to be. Tell us how you&rsquo;re
          feeling at check-in and we&rsquo;ll choose the tone for your session.
        </p>
      </section>

      {/* ------------------------------------------------------- SESSIONS + BOOK */}
      <section className="border-t" style={{ background: "var(--clinic-tint-soft)" }}>
        <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Sessions</Eyebrow>
            <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
              Book your session
            </h2>
          </div>

          {services.length > 0 ? (
            <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div key={s.id} className="rounded-2xl border bg-background p-6">
                  <h3 className="text-lg font-medium tracking-tight">{s.name}</h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                  </p>
                  <p className="mt-4 text-2xl font-light tracking-tight">
                    {money(Number(s.price))}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {bookable ? (
            <div id="request" className="mx-auto mt-12 max-w-2xl scroll-mt-8">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                You&rsquo;ll request a time and {org.name} will confirm it with you. Payment is
                made at your appointment.
              </p>
              <PublicBookingForm
                slug={org.slug}
                services={services}
                timezone={tz}
                clinicName={org.name}
              />
            </div>
          ) : (
            <div className="mx-auto mt-12 max-w-xl rounded-2xl border bg-background p-8 text-center">
              <h3 className="text-lg font-medium tracking-tight">Get in touch to book</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Online requests aren&rsquo;t open right now — contact {org.name} directly and
                we&rsquo;ll find a time.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {org.public_contact_phone ? (
                  <a
                    href={`tel:${org.public_contact_phone.replace(/\s+/g, "")}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium"
                    style={{
                      background: "var(--clinic-accent)",
                      color: "var(--clinic-accent-fg)",
                    }}
                  >
                    <Phone className="h-4 w-4" /> {org.public_contact_phone}
                  </a>
                ) : null}
                {org.public_contact_email ? (
                  <a
                    href={`mailto:${org.public_contact_email}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border px-6 text-sm font-medium"
                  >
                    <Mail className="h-4 w-4" /> {org.public_contact_email}
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------------- CONTACT */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-24">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Eyebrow>Contact</Eyebrow>
            <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">{org.name}</h2>
            <dl className="mt-6 grid gap-3 text-sm">
              {org.clinic_type === "retail" && org.public_address ? (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{org.public_address}</span>
                </div>
              ) : org.public_suburb ? (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{org.public_suburb}</span>
                </div>
              ) : null}
              {org.clinic_type === "home" ? (
                <p className="flex items-start gap-3 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This is a home-based studio. Your therapist&rsquo;s address stays private and
                    is shared with you only once your booking is confirmed.
                  </span>
                </p>
              ) : null}

              {org.public_contact_phone ? (
                <a
                  className="flex items-center gap-3 hover:underline"
                  href={`tel:${org.public_contact_phone.replace(/\s+/g, "")}`}
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {org.public_contact_phone}
                </a>
              ) : null}
              {org.public_contact_email ? (
                <a
                  className="flex items-center gap-3 hover:underline"
                  href={`mailto:${org.public_contact_email}`}
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {org.public_contact_email}
                </a>
              ) : null}
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Times shown in {tz.replace("_", " ")}.</span>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border p-8" style={{ background: "var(--clinic-tint-soft)" }}>
            <h3 className="text-lg font-medium tracking-tight">A natural add-on</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A vibroacoustic session pairs beautifully with massage or bodywork — before, to help
              the body let go, or after, to hold the calm a little longer. Ask us about adding one
              to your usual appointment.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- FOOTER */}
      <footer
        className="py-14"
        style={{ background: "var(--clinic-ink)", color: "var(--clinic-ink-fg)" }}
      >
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 70%, transparent)" }}
          >
            Vibroacoustic sessions are provided for relaxation and general wellbeing. They are not
            a medical treatment, are not intended to diagnose, treat, cure or prevent any
            condition, and are not a substitute for advice from a qualified health professional. If
            you have a health concern, are pregnant, or have an implanted medical device such as a
            pacemaker, please speak with your doctor before booking.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              to="/auth"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-current/25 px-5 text-sm font-medium opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <LogIn className="h-4 w-4" />
              Therapist login
            </Link>
            <p
              className="text-xs uppercase tracking-[0.18em]"
              style={{ color: "color-mix(in oklab, var(--clinic-ink-fg) 45%, transparent)" }}
            >
              Powered by Resonabed
            </p>
          </div>

        </div>
      </footer>

      {bookable ? <StickyBookCta /> : null}
      {bookable ? <div className="h-16 md:hidden" aria-hidden /> : null}
    </main>
  );
}
