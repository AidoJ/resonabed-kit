/**
 * Stripe webhook: drives the kit_orders state machine.
 *
 *   checkout.session.completed  stage=deposit      -> deposit_paid (ships NOTHING)
 *                               stage=balance_full -> balance_paid -> fulfilled
 *                               stage=balance_plan -> plan_active  -> fulfilled
 *   invoice.paid                                   -> counts a plan monthly,
 *                                                     stops the plan at exactly N
 *   invoice.payment_failed                         -> logged only (Phase 3)
 *   charge.refunded                                -> order refunded
 *
 * Signature-verified and idempotent. Configure in Stripe against
 * https://resonabed.com/api/public/hooks/stripe
 */
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_SECRET_KEY"];
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret || !webhookSecret) {
          console.error("Stripe webhook is not configured");
          return new Response("Not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const stripe = new Stripe(secret);

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (err) {
          console.error("Stripe webhook signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const { fulfilCheckoutSession } = await import("@/lib/order-fulfilment.server");
              const result = await fulfilCheckoutSession(
                event.data.object as Stripe.Checkout.Session,
              );
              // Never leak the private balance token through the webhook reply.
              const { balanceToken: _token, ...safe } = result;
              return Response.json({ received: true, ...safe });
            }
            case "invoice.paid": {
              const { handlePlanInvoicePaid } = await import("@/lib/order-fulfilment.server");
              const result = await handlePlanInvoicePaid(event.data.object as Stripe.Invoice, secret);
              return Response.json({ received: true, ...result });
            }
            case "invoice.payment_failed": {
              const { handlePlanInvoiceFailed } = await import("@/lib/order-fulfilment.server");
              const result = await handlePlanInvoiceFailed(event.data.object as Stripe.Invoice);
              return Response.json({ received: true, ...result });
            }
            case "charge.refunded": {
              const { handleChargeRefunded } = await import("@/lib/order-fulfilment.server");
              const result = await handleChargeRefunded(event.data.object as Stripe.Charge);
              return Response.json({ received: true, ...result });
            }
            default:
              return Response.json({ received: true, ignored: event.type });
          }
        } catch (err) {
          // Returning 500 asks Stripe to retry, which is what we want.
          console.error("Stripe webhook handling failed", event.type, err);
          return new Response("Webhook handling failed", { status: 500 });
        }
      },
    },
  },
});
