import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { getDirectoryClinics } from "@/lib/directory.functions";
import { STATE_NAMES, groupDirectory } from "@/lib/directory-groups";
import { SITE_URL, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

const TITLE = "Vibroacoustic therapy practitioners, Australia | Resonabed";
const DESCRIPTION =
  "Find a clinic offering Resonabed vibroacoustic therapy sessions near you, listed by state and suburb.";
const URL = `${SITE_URL}/practitioners`;

export const Route = createFileRoute("/practitioners")({
  staticData: { sitemap: true },
  loader: async () => ({ clinics: await getDirectoryClinics() }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [jsonLdScript(breadcrumbJsonLd([{ name: "Practitioners", path: "/practitioners" }]))],
  }),
  component: PractitionersPage,
});

function PractitionersPage() {
  const { clinics } = Route.useLoaderData();
  const groups = groupDirectory(clinics);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand-ink text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:px-10 md:py-20">
          <Link to="/" className="inline-flex items-center text-sm text-white/70 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resonabed
          </Link>
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            Practitioner directory
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-light leading-tight md:text-5xl">
            Vibroacoustic therapy practitioners in Australia
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            Clinics using the Resonabed system that have chosen to be listed here. Open a clinic
            to see its sessions and how to book.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
        {groups.length === 0 ? (
          <p className="text-muted-foreground">No clinics are listed yet. Please check back soon.</p>
        ) : (
          <div className="space-y-14">
            {groups.map((g) => (
              <section key={g.state} aria-labelledby={`state-${g.state}`}>
                <h2
                  id={`state-${g.state}`}
                  className="text-2xl font-light tracking-tight text-brand-indigo md:text-3xl"
                >
                  {STATE_NAMES[g.state] ?? g.state}
                </h2>
                <div className="mt-6 grid gap-8 md:grid-cols-2">
                  {g.suburbs.map((sub) => (
                    <div key={sub.suburb}>
                      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {sub.suburb}
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {sub.clinics.map((c) => (
                          <li key={c.slug}>
                            <Link
                              to="/o/$slug"
                              params={{ slug: c.slug }}
                              className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-brand-violet-strong/40"
                            >
                              <span>
                                <span className="block text-base font-medium text-brand-indigo">
                                  {c.name}
                                </span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                  {[c.suburb, c.state, c.postcode].filter(Boolean).join(" ")}
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 shrink-0 text-brand-violet-strong transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="mt-16 text-xs leading-relaxed text-muted-foreground">
          Resonabed is a wellbeing product. It is not a medical device and is not intended to
          diagnose, treat, cure or prevent any disease.
        </p>
      </section>
    </main>
  );
}
