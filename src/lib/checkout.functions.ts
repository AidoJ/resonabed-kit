import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";

const PACKAGES = {
  pro: {
    name: "Resonabed Pro Kit",
    description:
      "Complete upgrade kit: 2x tactile transducers, Bluetooth amplifier, wiring & fittings, Resonabed session player + booking app, 9 Solfeggio frequencies, 250 DL marketing flyers.",
    amount: 119900,
    installments: { deposit: 39900, monthly: 10000, months: 8 }, // 399 + 8*100 = 1199
  },
  premium: {
    name: "Resonabed Premium Kit",
    description:
      "Everything in Pro, plus a 9\" Android tablet pre-configured for session-only use.",
    amount: 139900,
    installments: { deposit: 39900, monthly: 10000, months: 10 }, // 399 + 10*100 = 1399
  },
} as const;

type PackageKey = keyof typeof PACKAGES;

const InputSchema = z.object({
  package: z.enum(["pro", "premium"]),
  plan: z.enum(["full", "installments"]).default("full"),
  origin: z.string().url(),
});

const SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US","CA","GB","IE","AU","NZ","DE","FR","NL","BE",
  "ES","IT","PT","SE","NO","DK","FI","CH","AT","PL",
];

export const createKitCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secret);
    const pkg = PACKAGES[data.package as PackageKey];

    const baseParams = {
      ui_mode: "embedded",
      payment_method_types: ["card"],
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      return_url: `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    } satisfies Partial<Stripe.Checkout.SessionCreateParams>;

    let session: Stripe.Checkout.Session;

    if (data.plan === "installments") {
      const { deposit, monthly, months } = pkg.installments;



      const params: Stripe.Checkout.SessionCreateParams = {
        ...baseParams,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `${pkg.name} — Deposit` },
              unit_amount: deposit,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${pkg.name} — Monthly payment`,
                description: `${months} monthly payments of $${(monthly / 100).toFixed(0)} following the deposit.`,
              },
              unit_amount: monthly,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          description: `${pkg.name} — repayment plan (${months} months)`,
          metadata: {
            package: data.package,
            plan: "installments",
            months: String(months),
            cancel_after_months: String(months),
          },
        },


        allow_promotion_codes: false,
        metadata: { package: data.package, plan: "installments" },
      };
      session = await stripe.checkout.sessions.create(params);
    } else {
      const params: Stripe.Checkout.SessionCreateParams = {
        ...baseParams,
        mode: "payment",
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
        allow_promotion_codes: true,
        metadata: { package: data.package, plan: "full" },
      };
      session = await stripe.checkout.sessions.create(params);
    }


    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    return { clientSecret: session.client_secret };
  });

const FinalizeSchema = z.object({ sessionId: z.string().min(1) });

/**
 * Called after a successful installments checkout. Reads the subscription
 * from the session and sets `cancel_at` so billing stops after the last
 * planned monthly payment. Idempotent — safe to call multiple times.
 */
export const finalizeInstallmentsPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizeSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secret);

    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });
    if (session.mode !== "subscription") return { ok: true, skipped: "not-subscription" };
    const sub = session.subscription;
    if (!sub || typeof sub === "string") return { ok: true, skipped: "no-subscription" };

    const monthsRaw = sub.metadata?.cancel_after_months ?? sub.metadata?.months;
    const months = monthsRaw ? Number(monthsRaw) : NaN;
    if (!Number.isFinite(months) || months <= 0) return { ok: true, skipped: "no-months" };

    if (sub.cancel_at) return { ok: true, alreadySet: true };

    // Anchor to current_period_start + months (30d approximation to align with monthly cycles)
    const anchor = sub.current_period_start ?? Math.floor(Date.now() / 1000);
    const cancelAt = anchor + months * 30 * 24 * 60 * 60 + 24 * 60 * 60;
    await stripe.subscriptions.update(sub.id, { cancel_at: cancelAt });
    return { ok: true, cancelAt };
  });



export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Stripe publishable key is not configured");
  return { publishableKey: key };
});
