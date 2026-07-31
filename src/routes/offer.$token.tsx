import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { getOffer, acceptOffer, declineOffer } from "@/lib/offer-public.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatInTz, tzAbbrev } from "@/lib/timezone";

export const Route = createFileRoute("/offer/$token")({
  head: () => ({
    meta: [
      { title: "Choose a session time — ResonaBed" },
      {
        name: "description",
        content:
          "Pick one of the alternative session times your clinic has suggested, or let them know none of them suit.",
      },
      { property: "og:title", content: "Choose a session time" },
      {
        property: "og:description",
        content: "Pick one of the alternative session times your clinic has suggested.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }) => getOffer({ data: { token: params.token } }),
  component: OfferPage,
});

const DEAD_END_COPY: Record<string, string> = {
  not_found: "This link isn't valid. It may have already been used.",
  expired: "These times have expired.",
  accepted: "These times have already been booked.",
  withdrawn: "These times are no longer being offered.",
};

function OfferPage() {
  const initial = Route.useLoaderData();
  const { token } = useParams({ from: "/offer/$token" });
  const accept = useServerFn(acceptOffer);
  const decline = useServerFn(declineOffer);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"open" | "booked" | "declined">("open");

  if (!initial.ok) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{DEAD_END_COPY[initial.reason]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please contact the clinic directly, or make a fresh booking request from their page.
        </p>
      </Shell>
    );
  }

  const offer = initial.offer;
  const tz = offer.timezone;

  if (state === "booked") {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-3 text-xl font-semibold">You&rsquo;re booked in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {offer.clinicName} has confirmed your session and sent the details to your email,
          including where to go.
        </p>
      </Shell>
    );
  }

  if (state === "declined") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Thanks — we&rsquo;ve let them know</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {offer.clinicName} knows none of those times suited and will be in touch.
          {offer.contactPhone ? ` You can also call ${offer.contactPhone}.` : ""}
        </p>
      </Shell>
    );
  }

  const onAccept = async (slotId: string) => {
    setBusy(slotId);
    setError(null);
    try {
      const res = await accept({ data: { token, slot_id: slotId } });
      if (res.ok) setState("booked");
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onDecline = async () => {
    setBusy("decline");
    try {
      await decline({ data: { token } });
      setState("declined");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell align="left">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {offer.clinicName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Hi {offer.clientName}, pick a time</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The time you asked for wasn&rsquo;t available. Choose whichever of these suits you and
        it&rsquo;s yours — {offer.serviceName}.
      </p>

      <div className="mt-6 grid gap-3">
        {offer.slots.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">
                  {formatInTz(s.starts_at, tz, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  <span className="text-xs text-muted-foreground">({tzAbbrev(tz)})</span>
                </span>
              </div>
              <Button onClick={() => onAccept(s.id)} disabled={busy !== null}>
                {busy === s.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Book this time
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Held until{" "}
        {formatInTz(offer.expires_at, tz, {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
        })}
        . Full details, including where to come, are emailed once a time is booked.
      </p>

      <Button variant="ghost" className="mt-3 px-0" onClick={onDecline} disabled={busy !== null}>
        None of these work
      </Button>
    </Shell>
  );
}

function Shell({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
      <div className={align === "center" ? "text-center" : ""}>{children}</div>
    </main>
  );
}
