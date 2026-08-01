import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finalizeCheckoutSession } from "@/lib/checkout.functions";

export const Route = createFileRoute("/order/success")({
  head: () => ({
    meta: [
      { title: "Order confirmed · Resonabed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderSuccess,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
});

function OrderSuccess() {
  const { session_id } = Route.useSearch();
  const finalize = useServerFn(finalizeCheckoutSession);

  const [codeEmail, setCodeEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!session_id) return;
    finalize({ data: { sessionId: session_id } })
      .then((res) => {
        const email = (res as { codeEmail?: string | null })?.codeEmail ?? null;
        if (email) setCodeEmail(email);
      })
      .catch((err) => {
        // Non-fatal: payment is already complete; admin records can be reconciled manually.
        console.error("finalizeCheckoutSession failed", err);
      });
  }, [session_id, finalize]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-violet/10 text-brand-violet-strong">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Thank you, your order is confirmed.
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          You'll receive a receipt by email shortly. Our team will be in touch within one business
          day to confirm shipping details and next steps.
        </p>
        <div className="mt-8 w-full rounded-2xl border border-brand-violet/20 bg-brand-violet/5 p-6 text-left">
          <h2 className="text-lg font-medium text-brand-indigo">Your personal Resonabed app</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your kit includes the personal app for home use. We've emailed a one-time access code
            {codeEmail ? ` to ${codeEmail}` : " to the address used at checkout"}. Enter it at{" "}
            <Link to="/home/signup" className="text-brand-violet-strong underline">
              resonabed.com/home/signup
            </Link>{" "}
            to create your account, it stays with you for good.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Code not arrived within a few minutes? Check your junk folder, or email
            info@resonabed.com and we'll reissue it.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/">
            <Button className="h-11 rounded-full px-6">Back to home</Button>
          </Link>
          <a href="mailto:info@resonabed.com">
            <Button variant="outline" className="h-11 rounded-full px-6">
              Contact us
            </Button>
          </a>
        </div>
      </div>
    </main>
  );
}
