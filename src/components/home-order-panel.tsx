import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createKitCheckoutSession, requestKitEftInvoice } from "@/lib/checkout.functions";
import { EmbeddedCheckoutDialog } from "@/components/embedded-checkout-dialog";
import { PromoStepDialog } from "@/components/promo-step-dialog";
import {
  PaymentMethodStepDialog,
  EftInvoiceDialog,
  type EftInvoiceResult,
  type EftContactDetails,
} from "@/components/payment-method-step-dialog";
import {
  ShippingAddressStepDialog,
  type ShippingContinuePayload,
  type EnteredShippingAddress,
} from "@/components/shipping-address-step-dialog";

const PRICE_CENTS = 159900;
const PRICE = "$1,599";
const PLAN = { deposit: 799, monthly: 100, months: 8 };

const INCLUDES = [
  "Therapy table, fully fitted and ready to lie on",
  "Two 50W tactile transducers, amplifier, wiring and fittings",
  "Audio-Technica ATH-M30x headphones",
  "Personal Resonabed app with a perpetual licence",
  "The 9 Solfeggio frequencies, yours to keep",
];

/**
 * Buy panel for the $1,599 Resonabed for Home package.
 *
 * Same checkout path as the clinic kits, with one difference: the buyer type is
 * fixed to "for home use", so payment always issues a home access code by email
 * through the Stripe webhook, never the clinic onboarding queue.
 */
export function HomeOrderPanel() {
  const startCheckout = useServerFn(createKitCheckoutSession);
  const requestInvoice = useServerFn(requestKitEftInvoice);

  const [loading, setLoading] = useState<"full" | "installments" | null>(null);
  const [activePlan, setActivePlan] = useState<"full" | "installments">("full");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<"full" | "installments" | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingChoice, setShippingChoice] = useState<ShippingContinuePayload | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [payMethodOpen, setPayMethodOpen] = useState(false);
  const [promoChoice, setPromoChoice] = useState("");
  const [eftSubmitting, setEftSubmitting] = useState(false);
  const [eftResult, setEftResult] = useState<EftInvoiceResult | null>(null);

  const runCheckout = async (
    which: "full" | "installments",
    promoCode: string,
    ship: ShippingContinuePayload,
  ) => {
    setLoading(which);
    setActivePlan(which);
    try {
      const address: EnteredShippingAddress | undefined = ship.pickup ? undefined : ship.address;
      const { clientSecret: cs, appliedPromo, shipping } = await startCheckout({
        data: {
          package: "home",
          plan: which,
          origin: window.location.origin,
          promoCode: which === "full" ? promoCode : "",
          pickup: ship.pickup,
          shippingAddress: address,
          buyerType: "personal",
        },
      });
      const shippingBlurb = shipping
        ? shipping.amount === 0
          ? "Pickup, no shipping charge."
          : `Shipping to ${shipping.label}: $${(shipping.amount / 100).toFixed(2)} AUD${shipping.gstInclusive ? " (incl. GST)" : " (GST-free export)"}.`
        : null;
      const promoBlurb = appliedPromo
        ? `${appliedPromo.code} applied, ${appliedPromo.percentOff}% off, saving $${(appliedPromo.amountDiscounted / 100).toFixed(2)} AUD.`
        : null;
      const combined = ["For home use.", promoBlurb, shippingBlurb].filter(Boolean).join(" ");
      setCheckoutNote(combined || null);
      setClientSecret(cs);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout. Please try again.",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleOrder = (which: "full" | "installments") => {
    setPendingPlan(which);
    setShippingChoice(null);
    setShippingOpen(true);
  };

  const handleShippingContinue = (payload: ShippingContinuePayload) => {
    setShippingChoice(payload);
    setShippingOpen(false);
    if (pendingPlan === "full") setPromoOpen(true);
    else if (pendingPlan === "installments") void runCheckout("installments", "", payload);
  };

  const handleEftRequest = async (contact: EftContactDetails) => {
    if (!shippingChoice) return;
    setEftSubmitting(true);
    try {
      const result = await requestInvoice({
        data: {
          package: "home",
          promoCode: promoChoice,
          customerEmail: contact.email,
          customerPhone: contact.phone,
          pickup: shippingChoice.pickup,
          shippingAddress: shippingChoice.pickup ? undefined : shippingChoice.address,
          customerName: shippingChoice.pickup ? undefined : shippingChoice.address.name,
          buyerType: "personal",
        },
      });
      setPayMethodOpen(false);
      setEftResult(result);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't raise your invoice. Please contact us.",
      );
    } finally {
      setEftSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
      <span className="inline-flex rounded-full bg-brand-tint px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-violet-strong">
        For home use
      </span>
      <h3 className="mt-4 text-2xl font-medium tracking-tight text-brand-indigo">
        Resonabed for Home
      </h3>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-light tracking-tight text-brand-indigo md:text-5xl">
          {PRICE}
        </span>
        <span className="text-sm text-muted-foreground">AUD · incl. GST</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">$1,454 + $145 GST = $1,599</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Shipping is calculated at checkout based on your location (typically $80 to $150).
      </p>

      <ul className="mt-7 space-y-3">
        {INCLUDES.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet-strong" />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-9 space-y-3">
        <Button
          onClick={() => handleOrder("full")}
          disabled={loading !== null}
          className="h-11 w-full rounded-full bg-brand-indigo text-[14px] font-medium text-white hover:bg-brand-indigo/90"
        >
          {loading === "full" ? "Preparing checkout…" : `Order yours, ${PRICE}`}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <Button
          onClick={() => handleOrder("installments")}
          disabled={loading !== null}
          variant="outline"
          className="h-11 w-full rounded-full border-brand-indigo/25 bg-transparent text-[13px] font-medium text-brand-indigo hover:bg-brand-tint"
        >
          {loading === "installments"
            ? "Preparing checkout…"
            : `Deposit $${PLAN.deposit} + ${PLAN.months} × $${PLAN.monthly}/mo`}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Shipping calculated at checkout by location, typically $80 to $150 · payment plan total $
          {PLAN.deposit + PLAN.monthly * PLAN.months} incl. GST, billed monthly and stopping
          automatically after the final payment · you can also pay by bank transfer · secure
          checkout by Stripe
        </p>
      </div>

      <EmbeddedCheckoutDialog
        clientSecret={clientSecret}
        onClose={() => {
          setClientSecret(null);
          setCheckoutNote(null);
        }}
        subtitle={checkoutNote}
        title={
          activePlan === "installments"
            ? "Resonabed for Home, deposit + monthly plan"
            : "Complete your Resonabed for Home order"
        }
      />
      <ShippingAddressStepDialog
        open={shippingOpen}
        packagePriceCents={PRICE_CENTS}
        shippingScope="table"
        onCancel={() => {
          setShippingOpen(false);
          setPendingPlan(null);
        }}
        onContinue={handleShippingContinue}
      />
      <PromoStepDialog
        open={promoOpen}
        packageKey={promoOpen ? "home" : null}
        packagePrice={PRICE}
        onCancel={() => setPromoOpen(false)}
        onContinue={(code) => {
          setPromoOpen(false);
          setPromoChoice(code);
          setPayMethodOpen(true);
        }}
      />
      <PaymentMethodStepDialog
        open={payMethodOpen}
        price={PRICE}
        submitting={eftSubmitting}
        onCancel={() => setPayMethodOpen(false)}
        onCard={() => {
          setPayMethodOpen(false);
          if (shippingChoice) void runCheckout("full", promoChoice, shippingChoice);
        }}
        onEft={(contact) => void handleEftRequest(contact)}
      />
      <EftInvoiceDialog result={eftResult} onClose={() => setEftResult(null)} />
    </div>
  );
}
