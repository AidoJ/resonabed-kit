/**
 * The card-update landing page reached from a dunning email. No login, no
 * order number: the tokenised link opens a Stripe portal session scoped to
 * this customer's payment method and nothing else.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startCardUpdate } from "@/lib/arrears.functions";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/order/card/$token")({
  head: () => ({
    meta: [
      { title: "Update your Resonabed payment card" },
      {
        name: "description",
        content: "Update the card on your Resonabed payment plan and clear any missed payment.",
      },
      { property: "og:title", content: "Update your Resonabed payment card" },
      {
        property: "og:description",
        content: "Update the card on your Resonabed payment plan in about a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CardUpdatePage,
});

function CardUpdatePage() {
  const { token } = Route.useParams();
  const start = useServerFn(startCardUpdate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("done=1")) setDone(true);
  }, []);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await start({ data: { token } });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not open the card update page.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-16">
      <div className="mx-auto w-full max-w-lg rounded-2xl border bg-background p-8 shadow-sm">
        <img src={logo.url} alt="Resonabed" className="mb-8 h-8" />
        {done ? (
          <>
            <CheckCircle2 className="mb-4 h-10 w-10 text-primary" />
            <h1 className="text-2xl font-semibold">Thank you, that is all sorted</h1>
            <p className="mt-3 text-muted-foreground">
              We will collect any missed payment shortly. If your account was limited, it returns to
              normal the moment the payment clears, with nothing lost.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Update your payment card</h1>
            <p className="mt-3 text-muted-foreground">
              A payment on your Resonabed plan did not go through. Most of the time this is simply
              an expired or replaced card. Updating it takes about a minute.
            </p>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            <Button className="mt-6 w-full" size="lg" onClick={open} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Update my card
            </Button>
            <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Card details are handled entirely by Stripe. Resonabed never sees or stores your card
              number.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
