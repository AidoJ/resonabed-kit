import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Mail, Phone, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PublicOrg = {
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  slug: string;
  public_blurb: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  public_booking_enabled: boolean;
  timezone: string | null;
};

type PublicService = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

async function loadPublicPage(slug: string) {
  const [orgRes, svcRes] = await Promise.all([
    supabase.rpc("get_public_org", { p_slug: slug }),
    supabase.rpc("get_public_services", { p_slug: slug }),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  const org = (orgRes.data as PublicOrg[] | null)?.[0];
  if (!org) throw notFound();
  return { org, services: (svcRes.data as PublicService[] | null) ?? [] };
}

export const Route = createFileRoute("/o/$slug")({
  loader: ({ params }) => loadPublicPage(params.slug),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Page not available — Resonabed" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { org } = loaderData;
    const title = `${org.name} — Vibroacoustic relaxation sessions`;
    const description =
      org.public_blurb?.slice(0, 155) ??
      `Book a Resonabed vibroacoustic relaxation session with ${org.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
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
      <h1 className="text-2xl font-semibold">Page not available</h1>
      <p className="mt-2 text-muted-foreground">
        This clinic page doesn&rsquo;t exist, or it hasn&rsquo;t been published yet.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to Resonabed</Link>
      </Button>
    </main>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}

function PublicOrgPage() {
  const { org, services } = Route.useLoaderData();
  const accent = org.brand_color || undefined;

  return (
    <main className="min-h-screen bg-background">
      <section
        className="border-b bg-gradient-to-b from-primary/10 to-transparent"
        style={accent ? { background: `linear-gradient(to bottom, ${accent}1a, transparent)` } : undefined}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-14 text-center">
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={`${org.name} logo`}
              className="h-20 w-auto object-contain"
              loading="lazy"
            />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{org.name}</h1>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Vibroacoustic relaxation sessions
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-10">
        {org.public_blurb ? (
          <Card>
            <CardContent className="whitespace-pre-line pt-6 text-sm leading-relaxed">
              {org.public_blurb}
            </CardContent>
          </Card>
        ) : null}

        {services.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Sessions</h2>
            <div className="grid gap-3">
              {services.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">{money(Number(s.price))}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-lg font-semibold">Get in touch</h2>
          <Card>
            <CardContent className="grid gap-3 pt-6 text-sm">
              {org.public_contact_email ? (
                <a
                  className="inline-flex items-center gap-2 hover:underline"
                  href={`mailto:${org.public_contact_email}`}
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {org.public_contact_email}
                </a>
              ) : null}
              {org.public_contact_phone ? (
                <a
                  className="inline-flex items-center gap-2 hover:underline"
                  href={`tel:${org.public_contact_phone.replace(/\s+/g, "")}`}
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {org.public_contact_phone}
                </a>
              ) : null}
              {!org.public_contact_email && !org.public_contact_phone ? (
                <p className="text-muted-foreground">Contact details coming soon.</p>
              ) : null}
              {org.timezone ? (
                <p className="text-muted-foreground">
                  Appointment times are shown in {org.timezone.replace("_", " ")}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Sessions are for relaxation and general wellbeing. They are not a medical treatment and
          are not a substitute for advice from a qualified health professional.
        </p>
      </div>
    </main>
  );
}
