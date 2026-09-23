import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, CalendarDays, Check, LoaderCircle, Megaphone, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import treatment from "@/assets/demo-treatment.webp.asset.json";
import logo from "@/assets/resonabed-logo-signature.png.asset.json";
import { getDemoCaptcha, submitDemoEnquiry } from "@/lib/demo-enquiries.functions";
import "./demo.css";

const DESCRIPTION = "Add Vibro Acoustic Therapy to your clinic or home practice. Simple setup, booking system and marketing materials in one package. Request a free demo.";

const FAQS = [
  ["What is Vibro Acoustic Therapy?", "Vibro Acoustic Therapy combines audio with gentle, low-frequency vibration felt through a treatment table. ResonaBed gives you a second therapy to offer alongside your existing services, as a separately bookable session or an addition to a client visit."],
  ["What is included in the package?", "Your ResonaBed package brings together the therapy setup, a booking system and marketing collateral to help introduce the service to your clients. We will walk you through the table options, setup and support, and show you exactly what is included in your chosen package."],
  ["Is this suitable for a home practice?", "ResonaBed is designed to fit into a fixed treatment space, including a clinic or home practice. In your demo, we can discuss your room, your current table and how the service could fit around your existing appointments."],
  ["Can I use my existing treatment table?", "There is a kit for compatible timber-base treatment tables, as well as a package with a fitted table. We will help you work out which option suits your practice."],
  ["How could it generate additional income?", "You can offer ResonaBed as a paid session or an addition to your existing services. You choose how to price and schedule it. The income it generates will depend on your client demand, pricing, bookings and costs; your demo can help you assess the opportunity for your practice."],
  ["What will you show me in the demo?", "We will show you the therapy setup, session controls, booking system and marketing materials. We can also discuss package prices, delivery and support, so you can decide whether it makes sense for your practice. Online demos are available; ask us about in-person availability if you would like to feel the therapy yourself."],
] as const;

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "ResonaBed | Add a second therapy to your practice" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "ResonaBed | Add a second therapy to your practice" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ResonaBed | Add a second therapy to your practice" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "preload", as: "image", href: treatment.url }],
  }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <div className="demo-page">
      <a className="demo-skip" href="#demo-main">Skip to content</a>
      <header className="demo-header">
        <Link className="demo-wordmark" to="/" aria-label="ResonaBed home">
          <img src={logo.url} alt="Resonabed. Feel. Rest. Restore." />
        </Link>
        <nav aria-label="Demo page navigation">
          <a className="demo-nav-link" href="#experience">The opportunity</a>
          <a className="demo-nav-link" href="#practice">What’s included</a>
          <a className="demo-button demo-button-small" href="#request-demo">Request a demo <ArrowUpRight size={17} /></a>
        </nav>
      </header>
      <main id="demo-main">
        <section className="demo-hero demo-wrap">
          <div>
            <p className="demo-eyebrow">FOR CLINICS &amp; HOME PRACTICES</p>
            <h1>A second therapy.<br /><em>A new income stream.</em></h1>
            <p className="demo-hero-sub">Add Vibro Acoustic Therapy to your practice.</p>
            <p className="demo-hero-description">A simple way to expand your services, with the therapy setup, booking system and marketing materials brought together in one package.</p>
            <a className="demo-button" href="#request-demo">See the package in a free demo <ArrowUpRight size={19} /></a>
            <p className="demo-micro">Simple setup. Practical support. Your own practice.</p>
          </div>
          <figure className="demo-hero-visual">
            <img src={treatment.url} alt="A woman resting face up on a treatment table with headphones in a light-filled therapy room" width="1536" height="1024" fetchPriority="high" />
            <figcaption><span>A new service for your treatment room.</span><span>VIBRO ACOUSTIC THERAPY</span></figcaption>
          </figure>
        </section>
        <div className="demo-trust"><div className="demo-wrap demo-trust-inner"><span>Therapy setup included</span><span>Booking system included</span><span>Marketing materials included</span></div></div>
        <section className="demo-section demo-wrap demo-intro" id="experience">
          <div><p className="demo-eyebrow">BUILD ON THE PRACTICE YOU ALREADY HAVE</p><h2>Another service.<br /><em>More earning potential.</em></h2></div>
          <div className="demo-intro-copy"><p className="demo-large-copy">You already have the space.<br />Give it another way to earn.</p><p>ResonaBed makes it straightforward to introduce Vibro Acoustic Therapy alongside your existing treatments. Offer it as a paid session or an addition to a client visit, with pricing and appointments that work for your practice.</p><p>You bring your client relationships and professional care. We bring the setup, booking tools and marketing materials to help you get the new service started.</p></div>
        </section>
        <section className="demo-experience" id="practice"><div className="demo-wrap"><div className="demo-section-heading"><p className="demo-eyebrow">THE PACKAGE BEHIND YOUR NEW SERVICE</p><h2>The essentials, <em>already brought together.</em></h2></div><div className="demo-steps">
          <article><span className="demo-step-number">01</span><Wrench strokeWidth={1.3} /><h3>Simple therapy setup</h3><p>A kit for a compatible treatment table or a fitted-table package, with guidance to help you get started.</p></article>
          <article><span className="demo-step-number">02</span><CalendarDays strokeWidth={1.3} /><h3>A booking system</h3><p>A booking system and clinic booking page are included, giving clients a way to book your new service.</p></article>
          <article><span className="demo-step-number">03</span><Megaphone strokeWidth={1.3} /><h3>Marketing materials</h3><p>Collateral to help you introduce ResonaBed to your clients, including flyers for your practice.</p></article>
        </div></div></section>
        <section className="demo-section demo-wrap demo-practice"><div><p className="demo-eyebrow">FROM SETUP TO YOUR FIRST BOOKINGS</p><h2>A straightforward<br /><em>addition to your business.</em></h2><a className="demo-text-link" href="#request-demo">See how the package works <ArrowUpRight size={18} /></a></div><div className="demo-benefits">
          <article><span>01</span><div><h3>Choose the right setup</h3><p>We will discuss your clinic or home treatment room and help you choose a suitable table option.</p></div></article>
          <article><span>02</span><div><h3>Decide how to offer it</h3><p>Add a separately bookable service or offer it alongside your current treatments. Set your own session prices and schedule.</p></div></article>
          <article><span>03</span><div><h3>Introduce it to your clients</h3><p>Use the included marketing materials and booking system to help turn interest into appointments.</p></div></article>
        </div></section>
        <section className="demo-personal-note demo-wrap"><p className="demo-eyebrow">THE THERAPY YOU WILL BE OFFERING</p><h2>Sound your clients<br /><em>can feel.</em></h2><p>Vibro Acoustic Therapy combines audio with gentle vibration through a treatment table. Your client rests comfortably, fully clothed, while listening and feeling the vibration. A different service to introduce to the people who already trust your care.</p></section>
        <section className="demo-form-section" id="request-demo"><div className="demo-wrap demo-grid"><div className="demo-copy"><p className="demo-eyebrow">EXPLORE THE OPPORTUNITY FOR YOUR PRACTICE</p><h2>See your next<br /><em>service in action.</em></h2><p>Request a free demonstration of the complete package. See what it takes to get started and assess the opportunity for your clinic or home practice.</p><ul><li><Check />See the therapy setup and booking system</li><li><Check />Explore the included marketing materials</li><li><Check />Discuss costs and support, with no obligation</li></ul><div className="demo-note"><strong>Wherever your practice is based</strong><p>Explore ResonaBed with an online demonstration at a time that suits you. We will talk through your space, your service offer and your questions.</p></div></div><DemoForm /></div></section>
        <section className="demo-section demo-wrap demo-faq"><div><p className="demo-eyebrow">A FEW HELPFUL ANSWERS</p><h2>Before your <em>demo.</em></h2></div><div>{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      </main>
      <footer className="demo-wrap demo-footer"><Link className="demo-wordmark" to="/" aria-label="ResonaBed home"><img src={logo.url} alt="Resonabed. Feel. Rest. Restore." /></Link><p>A new therapy. A new opportunity for your practice.</p><a href="https://rejuvenators.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Privacy policy</a><span>© {new Date().getFullYear()} ResonaBed</span></footer>
      <a className="demo-button demo-mobile-cta" href="#request-demo">Request a free demo <ArrowUpRight size={18} /></a>
    </div>
  );
}

function DemoForm() {
  const getCaptcha = useServerFn(getDemoCaptcha);
  const submitEnquiry = useServerFn(submitDemoEnquiry);
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const submissionId = useRef("");
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getCaptcha().then(setCaptcha).catch(() => setError("The security check could not load. Please refresh the page."));
  }, [getCaptcha]);

  async function refreshCaptcha() {
    try { setCaptcha(await getCaptcha()); } catch { setCaptcha(null); }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || !captcha) return;
    setStatus("sending");
    setError("");
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    try {
      const result = await submitEnquiry({ data: {
        id: submissionId.current,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        practice: String(form.get("practice") ?? ""),
        suburb: String(form.get("suburb") ?? ""),
        phone: String(form.get("phone") ?? ""),
        website: String(form.get("website") ?? ""),
        captchaToken: captcha.token,
        captchaAnswer: String(form.get("captchaAnswer") ?? ""),
        source: params.get("utm_source") ?? "",
        medium: params.get("utm_medium") ?? "",
        campaign: params.get("utm_campaign") ?? "",
        content: params.get("utm_content") ?? "",
      } });
      setReference(result.reference);
      setStatus("success");
      window.dispatchEvent(new CustomEvent("resonabed:demo-requested", { detail: { reference: result.reference } }));
      window.setTimeout(() => successRef.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your enquiry could not be sent. Please try again.");
      setStatus("idle");
      await refreshCaptcha();
    }
  }

  if (status === "success") {
    return <div className="demo-form demo-success" ref={successRef} tabIndex={-1} role="status"><span className="demo-success-icon"><Check /></span><h3>Thank you for your interest.</h3><p>Your demo enquiry has been received. We will use the contact details you provided to discuss your practice and arrange the next step.</p><p className="demo-reference">Enquiry reference: {reference}</p></div>;
  }

  return (
    <form className="demo-form" onSubmit={onSubmit}>
      <h3>Explore the complete package.</h3><p className="demo-form-intro">Tell us about your clinic or home practice.</p>
      <div className="demo-fields">
        <div className="demo-field"><Label htmlFor="demo-name">Your name</Label><Input id="demo-name" name="name" autoComplete="name" required maxLength={100} /></div>
        <div className="demo-field"><Label htmlFor="demo-email">Email address</Label><Input id="demo-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
        <div className="demo-field demo-field-full"><Label htmlFor="demo-practice">Practice name</Label><Input id="demo-practice" name="practice" autoComplete="organization" required maxLength={150} /></div>
        <div className="demo-field"><Label htmlFor="demo-suburb">Suburb / city</Label><Input id="demo-suburb" name="suburb" autoComplete="address-level2" required maxLength={100} /></div>
        <div className="demo-field"><Label htmlFor="demo-phone">Phone <span>(optional)</span></Label><Input id="demo-phone" name="phone" type="tel" autoComplete="tel" minLength={6} maxLength={30} /></div>
        <div className="demo-field demo-field-full demo-security"><Label htmlFor="demo-captcha">Security check: {captcha?.question ?? "Loading…"}</Label><Input id="demo-captcha" name="captchaAnswer" inputMode="numeric" autoComplete="off" required maxLength={10} disabled={!captcha} /></div>
      </div>
      <div className="demo-honeypot" aria-hidden="true"><Label htmlFor="demo-website">Leave this blank</Label><Input id="demo-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {error ? <p className="demo-form-error" role="alert">{error} Your details are still here.</p> : null}
      <Button className="demo-form-submit" type="submit" disabled={status === "sending" || !captcha}>{status === "sending" ? <><LoaderCircle className="animate-spin" />Sending your request…</> : <>Request my free demo <ArrowUpRight size={18} /></>}</Button>
      <p className="demo-form-privacy">By submitting, you ask ResonaBed to contact you about your enquiry. We store your details to manage this request. <a href="https://rejuvenators.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Privacy policy</a>.</p>
    </form>
  );
}
