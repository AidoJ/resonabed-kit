import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/resonabed-logo.svg.asset.json";
import flyerPdf from "@/assets/resonabed-flyer.pdf.asset.json";
import flyerOutside from "@/assets/resonabed-flyer-outside.jpg.asset.json";
import flyerInside from "@/assets/resonabed-flyer-inside.jpg.asset.json";

export const Route = createFileRoute("/flyer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Marketing flyer — Resonabed client leaflet" },
      {
        name: "description",
        content:
          "Preview and download the Resonabed DL client flyer included with every kit: what vibroacoustic therapy is, what to expect in a session, and the nine Solfeggio tones.",
      },
      { property: "og:title", content: "Resonabed marketing flyer" },
      {
        property: "og:description",
        content:
          "The professionally designed DL client leaflet included with every Resonabed kit — preview both sides and download the print-ready PDF.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlyerPage,
});

function FlyerPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/75 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Resonabed
          </Link>
          <a href={flyerPdf.url} download target="_blank" rel="noreferrer">
            <Button
              variant="outline"
              className="h-10 rounded-full border-white/25 bg-white/10 px-5 text-sm font-medium text-white hover:bg-white/20 hover:text-white"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download print-ready PDF
            </Button>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center md:px-10">
        <img src={logo.url} alt="Resonabed" className="mx-auto h-12 w-auto" draggable={false} />
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
          Included with every kit
        </p>
        <h1 className="mt-3 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          The Resonabed client flyer
        </h1>
        <p className="mt-4 text-muted-foreground">
          250 professionally designed DL flyers ship with every kit — a calm, plain-language
          introduction your clients can pick up in reception. Space is left on the back panel for
          your clinic details.
        </p>
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-6 pb-24 md:px-10 md:pb-28">
        <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
          <img
            src={flyerOutside.url}
            alt="Outside of the Resonabed client flyer: cover panel, common questions, and what to expect in a session"
            className="h-auto w-full"
            loading="lazy"
          />
          <figcaption className="border-t border-border px-6 py-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Outside — cover, common questions, what to expect
          </figcaption>
        </figure>

        <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
          <img
            src={flyerInside.url}
            alt="Inside of the Resonabed client flyer: what vibroacoustic therapy is, why people come back, and the nine Solfeggio frequencies"
            className="h-auto w-full"
            loading="lazy"
          />
          <figcaption className="border-t border-border px-6 py-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Inside — what it is, why people come back, the nine tones
          </figcaption>
        </figure>

        <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
          <a href={flyerPdf.url} download target="_blank" rel="noreferrer">
            <Button className="h-12 rounded-full px-7 text-[15px] font-medium">
              <Download className="mr-1.5 h-4 w-4" />
              Download the flyer PDF
            </Button>
          </a>
          <Link to="/" hash="packages">
            <Button
              variant="outline"
              className="h-12 rounded-full border-brand-indigo/20 px-7 text-[15px] font-medium text-brand-indigo hover:bg-brand-tint"
            >
              See packages
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
