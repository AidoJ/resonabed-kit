import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { VatBenefitCards } from "@/components/research/benefit-cards";

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

type View = "mechanisms" | "benefits";

function ResearchPage() {
  const [view, setView] = useState<View>("mechanisms");
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
            Two separate bodies of evidence. How cells respond to mechanical movement in the
            laboratory, and what small human studies have explored about vibroacoustic therapy.
            Neither establishes outcomes for Resonabed.
          </p>
        </div>
      </section>

      <div className="border-b border-border bg-secondary/40">
        <div
          role="tablist"
          aria-label="Research views"
          className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-6 py-4 md:px-10"
        >
          {(
            [
              ["mechanisms", "View A · How cells sense movement"],
              ["benefits", "View B · Potential benefits studied in VAT"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={view === id}
              aria-controls={`panel-${id}`}
              tabIndex={view === id ? 0 : -1}
              onClick={() => setView(id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  setView((v) => (v === "mechanisms" ? "benefits" : "mechanisms"));
                }
              }}
              className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                view === id
                  ? "border-brand-violet bg-brand-violet text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="panel-mechanisms"
        aria-labelledby="tab-mechanisms"
        hidden={view !== "mechanisms"}
      >
        {view === "mechanisms" &&
          (mounted ? (
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
          ))}
      </div>

      <div
        role="tabpanel"
        id="panel-benefits"
        aria-labelledby="tab-benefits"
        hidden={view !== "benefits"}
      >
        {view === "benefits" && (
          <section aria-label="Potential benefits studied in VAT">
            <div className="mx-auto max-w-6xl px-6 pt-14 md:px-10">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                View B
              </p>
              <h2 className="mt-3 text-3xl font-light text-brand-indigo md:text-4xl">
                Potential benefits studied in VAT.
              </h2>
            </div>
            <VatBenefitCards />
          </section>
        )}
      </div>

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
