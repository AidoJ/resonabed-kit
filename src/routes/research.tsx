import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

// The canvas model is heavy; keep it off the first paint and off the homepage.
const CellularResponseSection = lazy(() =>
  import("@/components/public-clinic/cellular-response-section").then((m) => ({
    default: m.CellularResponseSection,
  })),
);

const TITLE = "Research | How cells sense movement and what VAT studies show";
const DESCRIPTION =
  "Explore the mechanisms behind vibroacoustic therapy: how cells sense mechanical movement, and what early VAT research does and does not establish about relaxation, tension, pain and sleep.";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand-ink text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:px-10 md:py-20">
          <Link to="/" className="inline-flex items-center text-sm text-white/70 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resonabed
          </Link>
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            Mechanisms and evidence
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-light leading-tight md:text-5xl">
            What the research actually says.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            How cells respond to mechanical movement in the laboratory, and what small human
            studies have explored about vibroacoustic therapy. Neither establishes outcomes for
            Resonabed.
          </p>
        </div>
      </section>

      {mounted ? (
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground md:px-10">
              Loading the cell model…
            </div>
          }
        >
          <CellularResponseSection />
        </Suspense>
      ) : (
        <div className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground md:px-10">
          Loading the cell model…
        </div>
      )}

      <section className="bg-brand-ink py-16 text-white md:py-20">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h2 className="text-2xl font-light md:text-3xl">
              See the system in your own treatment room.
            </h2>
            <p className="mt-3 text-sm text-white/70">
              Resonabed is a wellbeing product. It is not a medical device and is not intended to
              diagnose, treat, cure or prevent any disease.
            </p>
          </div>
          <Link to="/" hash="packages" className="shrink-0">
            <Button className="h-12 rounded-full bg-white px-7 text-brand-indigo hover:bg-white/90">
              Explore business packages <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
