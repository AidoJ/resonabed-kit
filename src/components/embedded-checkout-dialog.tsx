import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { getStripePublishableKey } from "@/lib/checkout.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

let stripePromiseCache: Promise<Stripe | null> | null = null;

export function EmbeddedCheckoutDialog({
  clientSecret,
  onClose,
  title,
}: {
  clientSecret: string | null;
  onClose: () => void;
  title: string;
}) {
  const getKey = useServerFn(getStripePublishableKey);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (!clientSecret) return;
    if (!stripePromiseCache) {
      stripePromiseCache = getKey().then(({ publishableKey }) => loadStripe(publishableKey));
    }
    setStripePromise(stripePromiseCache);
  }, [clientSecret, getKey]);

  const open = !!clientSecret;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-white p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-brand-indigo">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-2 py-4 sm:px-4">
          {clientSecret && stripePromise ? (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading secure checkout…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
