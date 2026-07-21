import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";

const PACKAGES = {
  pro: {
    name: "Resonabed Pro Kit",
    description:
      "Complete upgrade kit: 2x tactile transducers, Bluetooth amplifier, wiring & fittings, Resonabed session player + booking app, 9 Solfeggio frequencies, 250 DL marketing flyers.",
    amount: 119900,
  },
  premium: {
    name: "Resonabed Premium Kit",
    description:
      "Everything in Pro, plus a 9\" Android tablet pre-configured for session-only use.",
    amount: 139900,
  },
} as const;

type PackageKey = keyof typeof PACKAGES;

const InputSchema = z.object({
  package: z.enum(["pro", "premium"]),
  origin: z.string().url(),
});

export const createKitCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secret);
    const pkg = PACKAGES[data.package as PackageKey];

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: pkg.name, description: pkg.description },
            unit_amount: pkg.amount,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: [
          "US","CA","GB","IE","AU","NZ","DE","FR","NL","BE",
          "ES","IT","PT","SE","NO","DK","FI","CH","AT","PL",
        ],
      },
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      allow_promotion_codes: true,
      return_url: `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { package: data.package },
    });

    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    return { clientSecret: session.client_secret };
  });

export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Stripe publishable key is not configured");
  return { publishableKey: key };
});
