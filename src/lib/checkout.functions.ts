import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";

const PACKAGES = {
  pro: {
    name: "Resonabed Pro Kit",
    description:
      "Complete upgrade kit: 2x tactile transducers, Bluetooth amplifier, wiring & fittings, Resonabed session player + booking app, 9 Solfeggio frequencies, 250 DL marketing flyers. Price incl. GST — $1,090 + $109 GST = $1,199 AUD.",
    amount: 119900,
    exGst: 109000,
    gst: 10900,
    installments: { deposit: 39900, monthly: 10000, months: 8 }, // 399 + 8*100 = 1199
  },
  premium: {
    name: "Resonabed Premium Kit",
    description:
      "Everything in Pro, plus a 9\" Android tablet pre-configured for session-only use. Price incl. GST — $1,272 + $127 GST = $1,399 AUD.",
    amount: 139900,
    exGst: 127200,
    gst: 12700,
    installments: { deposit: 39900, monthly: 10000, months: 10 }, // 399 + 10*100 = 1399
  },
} as const;

type PackageKey = keyof typeof PACKAGES;

const ShippingAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().min(1).max(20),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase()),
});

const InputSchema = z
  .object({
    package: z.enum(["pro", "premium"]),
    plan: z.enum(["full", "installments"]).default("full"),
    origin: z.string().url(),
    promoCode: z.string().trim().min(3).max(40).optional().or(z.literal("")),
    pickup: z.boolean().default(false),
    shippingAddress: ShippingAddressSchema.optional(),
  })
  .refine((v) => v.pickup || v.shippingAddress, {
    message: "Shipping address is required unless pickup is selected",
    path: ["shippingAddress"],
  });

async function loadShippingRateForCountry(country: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("shipping_rates")
    .select("region, label, amount_cents, gst_inclusive, allowed_countries, active, sort_order")
    .eq("active", true)
    .gt("amount_cents", 0)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Could not load shipping rates");
  const iso = country.toUpperCase();
  const match = (data ?? []).find((r) =>
    Array.isArray(r.allowed_countries) &&
    (r.allowed_countries as string[]).map((c) => c.toUpperCase()).includes(iso),
  );
  if (!match) throw new Error("We don't ship to that country yet.");
  return {
    region: match.region,
    label: match.label,
    amount: match.amount_cents,
    gstInclusive: match.gst_inclusive,
  };
}

export const createKitCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secret);
    const pkg = PACKAGES[data.package as PackageKey];
    const normalizedPromoCode = data.promoCode?.trim().toUpperCase() || null;

    if (data.plan === "installments" && normalizedPromoCode) {
      throw new Error("Promo codes only apply to pay-in-full orders");
    }

    const isPickup = data.pickup;
    const addr = data.shippingAddress;

    // Resolve region + amount from country server-side. Never trust client amounts.
    const shipping = isPickup
      ? { region: "pickup", label: "Customer collects (pickup)", amount: 0, gstInclusive: false }
      : await loadShippingRateForCountry(addr!.country);

    const shippingGstNote = shipping.gstInclusive ? "incl. GST" : "GST-free export";
    const shippingLineName = `Shipping — ${shipping.label}`;
    const shippingLineDescription = `Flat-rate shipping to ${shipping.label} (${shippingGstNote}).`;

    const baseParams = {
      ui_mode: "embedded",
      payment_method_types: ["card"],
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      return_url: `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    } satisfies Partial<Stripe.Checkout.SessionCreateParams>;

    const shippingMetadata: Record<string, string> = {
      shipping_region: shipping.region,
      shipping_amount_cents: String(shipping.amount),
    };

    // Stripe shipping/customer address shape shared by both flows.
    const stripeAddress = addr
      ? {
          line1: addr.line1,
          line2: addr.line2 || undefined,
          city: addr.city,
          state: addr.state || undefined,
          postal_code: addr.postalCode,
          country: addr.country,
        }
      : undefined;

    let session: Stripe.Checkout.Session;

    if (data.plan === "installments") {
      const { deposit, monthly, months } = pkg.installments;

      // Attach the entered address to a Customer so it applies to the subscription's invoices.
      let customerId: string | undefined;
      if (!isPickup && addr && stripeAddress) {
        const customer = await stripe.customers.create({
          name: addr.name,
          address: stripeAddress,
          shipping: { name: addr.name, address: stripeAddress },
        });
        customerId = customer.id;
      }

      const params: Stripe.Checkout.SessionCreateParams = {
        ...baseParams,
        mode: "subscription",
        ...(customerId ? { customer: customerId } : {}),
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `${pkg.name} — Deposit`,
                description: `Deposit incl. GST — $363 + $36 GST = $399 AUD. Followed by ${months} monthly payments.`,
              },
              unit_amount: deposit,
            },
            quantity: 1,
          },
          ...(isPickup ? [] : [{
            price_data: {
              currency: "aud" as const,
              product_data: {
                name: shippingLineName,
                description: `${shippingLineDescription} Billed once with the deposit on the first invoice.`,
              },
              unit_amount: shipping.amount,
            },
            quantity: 1,
          }]),
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `${pkg.name} — Monthly payment`,
                description: `${months} monthly payments of $${(monthly / 100).toFixed(0)} incl. GST ($91 + $9 GST) following the deposit. Repayment total $${((deposit + monthly * months) / 100).toFixed(0)} AUD.`,
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
            ...shippingMetadata,
          },
        },
        allow_promotion_codes: false,
        metadata: { package: data.package, plan: "installments", ...shippingMetadata },
      };
      session = await stripe.checkout.sessions.create(params);
    } else {
      let payableAmount = pkg.amount;
      let promoMetadata: Record<string, string> = {};
      let appliedPromo: null | {
        id: string;
        code: string;
        percentOff: number;
        amountDiscounted: number;
        payableAmount: number;
      } = null;

      if (normalizedPromoCode) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: promo, error } = await supabaseAdmin
          .from("promo_codes")
          .select("id, code, active, discount_percent, max_redemptions, times_redeemed")
          .eq("code", normalizedPromoCode)
          .maybeSingle();

        if (error) throw new Error("We couldn't validate that promo code. Please try again.");
        if (!promo || !promo.active) throw new Error("That promo code is not active");
        if (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions) {
          throw new Error("That promo code has reached its redemption limit");
        }

        const amountDiscounted = Math.floor((pkg.amount * promo.discount_percent) / 100);
        payableAmount = pkg.amount - amountDiscounted;
        if (payableAmount < 50) throw new Error("This promo code discount is too high for checkout");

        promoMetadata = {
          promo_code_id: promo.id,
          promo_code: promo.code,
          promo_discount_percent: String(promo.discount_percent),
          amount_discounted_cents: String(amountDiscounted),
        };
        appliedPromo = {
          id: promo.id,
          code: promo.code,
          percentOff: promo.discount_percent,
          amountDiscounted,
          payableAmount,
        };
      }

      const discountDescription = appliedPromo
        ? `${pkg.description} Promo ${appliedPromo.code}: ${appliedPromo.percentOff}% off — saves $${(appliedPromo.amountDiscounted / 100).toFixed(2)} AUD.`
        : pkg.description;

      const params: Stripe.Checkout.SessionCreateParams = {
        ...baseParams,
        mode: "payment",
        ...(isPickup || !addr || !stripeAddress
          ? {}
          : {
              payment_intent_data: {
                shipping: { name: addr.name, address: stripeAddress },
              },
            }),
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: { name: pkg.name, description: discountDescription },
              unit_amount: payableAmount,
            },
            quantity: 1,
          },
          // Shipping is a separate, non-discounted line item — promo only touches the kit line.
          ...(isPickup ? [] : [{
            price_data: {
              currency: "aud" as const,
              product_data: {
                name: shippingLineName,
                description: shippingLineDescription,
              },
              unit_amount: shipping.amount,
            },
            quantity: 1,
          }]),
        ],
        allow_promotion_codes: false,
        metadata: { package: data.package, plan: "full", ...shippingMetadata, ...promoMetadata },
      };
      session = await stripe.checkout.sessions.create(params);
      if (!session.client_secret) throw new Error("Stripe did not return a client secret");
      return {
        clientSecret: session.client_secret,
        appliedPromo,
        shipping: { region: shipping.region, label: shipping.label, amount: shipping.amount, gstInclusive: shipping.gstInclusive },
      };
    }

    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    return {
      clientSecret: session.client_secret,
      appliedPromo: null,
      shipping: { region: shipping.region, label: shipping.label, amount: shipping.amount, gstInclusive: shipping.gstInclusive },
    };
  });

const FinalizeSchema = z.object({ sessionId: z.string().min(1) });

/**
 * Called after a successful installments checkout. Reads the subscription
 * from the session and sets `cancel_at` so billing stops after the last
 * planned monthly payment. Idempotent — safe to call multiple times.
 */
export const finalizeCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizeSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");
    const stripe = new Stripe(secret);

    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });
    if (session.mode !== "subscription") {
      const promoCodeId = session.metadata?.promo_code_id;
      if (session.payment_status !== "paid" || !promoCodeId) {
        return { ok: true, skipped: "not-discounted-payment" };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: redemptionError } = await supabaseAdmin
        .from("promo_code_redemptions")
        .insert({
          promo_code_id: promoCodeId,
          stripe_session_id: session.id,
          amount_discounted_cents: Number(session.metadata?.amount_discounted_cents ?? 0),
        });

      if (redemptionError && redemptionError.code !== "23505") {
        throw new Error(redemptionError.message);
      }

      if (!redemptionError) {
        const { data: promo } = await supabaseAdmin
          .from("promo_codes")
          .select("times_redeemed")
          .eq("id", promoCodeId)
          .single();
        if (promo) {
          await supabaseAdmin
            .from("promo_codes")
            .update({ times_redeemed: promo.times_redeemed + 1 })
            .eq("id", promoCodeId);
        }
      }

      return { ok: true, promoRecorded: !redemptionError };
    }
    const sub = session.subscription;
    if (!sub || typeof sub === "string") return { ok: true, skipped: "no-subscription" };

    const monthsRaw = sub.metadata?.cancel_after_months ?? sub.metadata?.months;
    const months = monthsRaw ? Number(monthsRaw) : NaN;
    if (!Number.isFinite(months) || months <= 0) return { ok: true, skipped: "no-months" };

    if (sub.cancel_at) return { ok: true, alreadySet: true };

    // Anchor to current_period_start + months (30d approximation to align with monthly cycles)
    const anchor = (sub as unknown as { current_period_start?: number }).current_period_start
      ?? sub.start_date
      ?? Math.floor(Date.now() / 1000);

    const cancelAt = anchor + months * 30 * 24 * 60 * 60 + 24 * 60 * 60;
    await stripe.subscriptions.update(sub.id, { cancel_at: cancelAt });
    return { ok: true, cancelAt };
  });

export const finalizeInstallmentsPlan = finalizeCheckoutSession;



export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Stripe publishable key is not configured");
  return { publishableKey: key };
});

const ValidatePromoSchema = z.object({
  package: z.enum(["pro", "premium"]),
  promoCode: z.string().trim().min(1).max(40),
});

export const validatePromoCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ValidatePromoSchema.parse(input))
  .handler(async ({ data }) => {
    const pkg = PACKAGES[data.package as PackageKey];
    const code = data.promoCode.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: promo, error } = await supabaseAdmin
      .from("promo_codes")
      .select("id, code, active, discount_percent, max_redemptions, times_redeemed")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error("We couldn't validate that promo code. Please try again.");
    if (!promo || !promo.active) throw new Error("That promo code is not active");
    if (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions) {
      throw new Error("That promo code has reached its redemption limit");
    }
    const amountDiscounted = Math.floor((pkg.amount * promo.discount_percent) / 100);
    const payableAmount = pkg.amount - amountDiscounted;
    if (payableAmount < 50) throw new Error("This promo code discount is too high for checkout");
    return {
      code: promo.code,
      percentOff: promo.discount_percent,
      originalAmount: pkg.amount,
      amountDiscounted,
      payableAmount,
    };
  });
