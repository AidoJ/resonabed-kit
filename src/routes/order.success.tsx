import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finalizeInstallmentsPlan } from "@/lib/checkout.functions";

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
  const finalize = useServerFn(finalizeInstallmentsPlan);

  useEffect(() => {
    if (!session_id) return;
    finalize({ data: { sessionId: session_id } }).catch((err) => {
      // Non-fatal: subscription still exists; scheduled cancellation can be set manually.
      console.error("finalizeInstallmentsPlan failed", err);
    });
  }, [session_id, finalize]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-violet/10 text-brand-violet-strong">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Thank you — your order is confirmed.
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          You'll receive a receipt by email shortly. Our team will be in touch within one business
          day to confirm shipping details and next steps.
        </p>
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
