import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";

const PACKAGES = {
  pro: {
    name: "Resonabed Pro Kit",
    description:
      "Complete upgrade kit: 2x tactile transducers, Bluetooth amplifier, wiring & fittings, Resonabed session player + booking app, 9 Solfeggio frequencies, 250 DL marketing flyers.",
    amount: 119900, // $1199.00 USD
  },
  premium: {
    name: "Resonabed Premium Kit",
    description:
      "Everything in Pro, plus a 9\" Android tablet pre-configured for session-only use.",
    amount: 139900, // $1399.00 USD
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
    if (!secret) {
      throw new Error("Stripe is not configured");
    }
    const stripe = new Stripe(secret);
    const pkg = PACKAGES[data.package as PackageKey];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pkg.name,
              description: pkg.description,
            },
            unit_amount: pkg.amount,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: [
          "US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "BE",
          "ES", "IT", "PT", "SE", "NO", "DK", "FI", "CH", "AT", "PL",
        ],
      },
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      success_url: `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/order/cancelled`,
      metadata: { package: data.package },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return { url: session.url };
  });
