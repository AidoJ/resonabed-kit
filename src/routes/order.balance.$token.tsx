/**
 * The returning-buyer step: the private link emailed after the $100 deposit.
 * One screen, two clear choices, no account and no order number to type in.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmbeddedCheckoutDialog } from "@/components/embedded-checkout-dialog";
import { EftInvoiceDialog, type EftInvoiceResult } from "@/components/payment-method-step-dialog";
import {
  createBalanceCheckoutSession,
  getOrderByBalanceToken,
  requestBalanceEftInvoice,
} from "@/lib/checkout.functions";
import { money } from "@/lib/packages";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/order/balance/$token")({
  head: () => ({
    meta: [
      { title: "Complete your Resonabed order" },
      {
        name: "description",
        content:
          "Settle the balance on your Resonabed order: pay in full, or start the 10 month payment plan.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BalancePage,
});

type Summary = Awaited<ReturnType<typeof getOrderByBalanceToken>>;

function BalancePage() {
  const { token } = Route.useParams();
  const loadOrder = useServerFn(getOrderByBalanceToken);
  const startBalance = useServerFn(createBalanceCheckoutSession);
  const requestEft = useServerFn(requestBalanceEftInvoice);

  const [order, setOrder] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "full" | "plan" | "eft">(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [eftResult, setEftResult] = useState<EftInvoiceResult | null>(null);

  useEffect(() => {
    let live = true;
    loadOrder({ data: { token } })
      .then((res) => {
        if (live) setOrder(res);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "We couldn't load that order.");
      });
    return () => {
      live = false;
    };
  }, [loadOrder, token]);

  const choose = async (path: "full" | "plan") => {
    setBusy(path);
    try {
      const { clientSecret: cs } = await startBalance({
        data: { token, path, origin: window.location.origin },
      });
      setClientSecret(cs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open checkout.");
    } finally {
      setBusy(null);
    }
  };

  const chooseEft = async () => {
    setBusy("eft");
    try {
      const result = await requestEft({ data: { token } });
      setEftResult({ ...result, shippingLabel: "Already paid with your deposit" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't raise your invoice.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh bg-brand-tint/40">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/">
            <img src={logo.url} alt="Resonabed" className="h-7 w-auto" />
          </Link>
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Complete your order
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {error ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <h1 className="text-2xl font-medium text-brand-indigo">We couldn't open that link</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please use the most recent link we emailed you, or contact us at info@resonabed.com
              and we will send a fresh one.
            </p>
          </div>
        ) : !order ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your order…
          </div>
        ) : order.state !== "deposit_paid" ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-violet-strong" />
            <h1 className="mt-4 text-2xl font-medium text-brand-indigo">
              {order.state === "expired"
                ? "This order hold has expired"
                : "Nothing left to pay here"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Order {order.orderNumber}, {order.packageLabel}, is currently{" "}
              {order.state.replace(/_/g, " ")}. If that looks wrong, email info@resonabed.com and we
              will sort it out.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-light tracking-tight text-brand-indigo md:text-4xl">
              Your order is secured
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Order {order.orderNumber}, {order.packageLabel}. Your ${order.depositCents / 100}{" "}
              deposit
              {order.shippingCents > 0 ? " and shipping" : ""} is paid. Choose how to settle the
              balance and we will start building your kit.
            </p>

            <div className="mt-9 grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">
                <h2 className="text-lg font-medium text-brand-indigo">Pay the balance in full</h2>
                <p className="mt-4 text-3xl font-light text-brand-indigo">
                  {money(order.balanceCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AUD incl. GST
                  {order.promoCode ? `, promo ${order.promoCode} applied` : ""}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  One payment, nothing further to pay. Shipping is already covered.
                </p>
                <Button
                  onClick={() => void choose("full")}
                  disabled={busy !== null}
                  className="mt-6 h-11 w-full rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
                >
                  {busy === "full" ? "Preparing checkout…" : "Pay in full"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  onClick={() => void chooseEft()}
                  disabled={busy !== null}
                  variant="ghost"
                  className="mt-2 h-9 w-full rounded-full text-xs text-muted-foreground"
                >
                  {busy === "eft" ? "Raising invoice…" : "Or pay by bank transfer"}
                </Button>
              </div>

              <div className="rounded-3xl border border-transparent bg-brand-ink p-7 text-white shadow-lift">
                <h2 className="text-lg font-medium">Start a payment plan</h2>
                <p className="mt-4 text-3xl font-light">
                  {money(order.plan.depositBalanceCents)}
                  <span className="text-base font-light text-white/60"> now</span>
                </p>
                <p className="mt-1 text-xs text-white/60">
                  then {order.plan.months} monthly payments of {money(order.plan.monthlyCents)}
                </p>
                <p className="mt-4 text-sm text-white/75">
                  Plan total {money(order.plan.totalCents)} incl. GST including your deposit.
                  Billing stops automatically after the final payment.
                </p>
                <Button
                  onClick={() => void choose("plan")}
                  disabled={busy !== null}
                  className="mt-6 h-11 w-full rounded-full bg-white text-brand-ink hover:bg-white/90"
                >
                  {busy === "plan" ? "Preparing checkout…" : "Start the payment plan"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="mt-2 text-center text-[11px] text-white/50">
                  Payment plans are card only.
                </p>
              </div>
            </div>

            <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet-strong" />
              This link is private to your order. Your deposit holds it until{" "}
              {order.expiresAt ? new Date(order.expiresAt).toLocaleDateString("en-AU") : "30 days"}.
              If you decide not to go ahead before then, email info@resonabed.com and we will refund
              your deposit and shipping in full.
            </p>
          </>
        )}
      </div>

      <EmbeddedCheckoutDialog
        clientSecret={clientSecret}
        onClose={() => setClientSecret(null)}
        title="Complete your Resonabed order"
        subtitle={order ? `Order ${order.orderNumber}, ${order.packageLabel}` : null}
      />
      <EftInvoiceDialog result={eftResult} onClose={() => setEftResult(null)} />
    </main>
  );
}
