import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/order/cancelled")({
  head: () => ({
    meta: [
      { title: "Order cancelled · Resonabed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderCancelled,
});

function OrderCancelled() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <XCircle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
          Checkout cancelled
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          No payment was taken. You can pick up where you left off, or reach out if you'd like to
          talk through the kit first.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/">
            <Button className="h-11 rounded-full px-6">Return to home</Button>
          </Link>
          <a href="mailto:info@resonabed.com?subject=Resonabed%20kit%20enquiry">
            <Button variant="outline" className="h-11 rounded-full px-6">
              Talk to us
            </Button>
          </a>
        </div>
      </div>
    </main>
  );
}
