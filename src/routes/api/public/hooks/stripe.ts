/**
 * Stripe webhook: fulfils a kit purchase the moment it completes. Personal
 * buyers get a home-app access code; business buyers land in the clinic
 * onboarding queue for a human to provision. Signature-verified, idempotent (one live code per checkout
 * session), and independent of whether the buyer's browser reaches
 * /order/success.
 *
 * Configure in Stripe with the event `checkout.session.completed` pointing at
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

        if (event.type !== "checkout.session.completed") {
          return Response.json({ received: true });
        }

        const session = event.data.object as Stripe.Checkout.Session;

        try {
          const { fulfilCheckoutSession } = await import("@/lib/order-fulfilment.server");
          const result = await fulfilCheckoutSession(session);
          return Response.json({ received: true, ...result });
        } catch (err) {
          // Returning 500 asks Stripe to retry, which is what we want.
          console.error("Failed to fulfil checkout session from Stripe webhook", err);
          return new Response("Failed to fulfil order", { status: 500 });
        }
      },
    },
  },
});
