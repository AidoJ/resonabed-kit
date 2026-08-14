/**
 * Deposit-first checkout: all Stripe mechanics live here, the server functions
 * in checkout.functions.ts are thin wrappers around these helpers.
 *
 * Step 1 (deposit): $100 order deposit + shipping, one payment. Secures the
 *   order for 30 days. Ships nothing.
 * Step 2 (balance): reached only through a private tokenised link. Either the
 *   remaining balance in one payment, or a "deposit balance" plus exactly 10
 *   monthly payments on a Stripe subscription.
 *
 * Shipping is charged once, in step 1, and is never re-added in step 2.
 */
import Stripe from "stripe";
import { z } from "zod";
import {
  PACKAGES,
  PACKAGE_KEYS,
  ORDER_DEPOSIT_CENTS,
  money,
  type PackageKey,
} from "@/lib/packages";
import {
  createOrderDraft,
  getOrderByToken,
  updateOrder,
  logOrderEvent,
  type KitOrderRow,
} from "@/lib/orders.server";

/* ------------------------------------------------------------------ schemas */

export const ShippingAddressSchema = z.object({
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

export const BusinessDetailsSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(200),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  abn: z.string().trim().max(20).optional().or(z.literal("")),
});

export type BusinessDetails = z.infer<typeof BusinessDetailsSchema>;

export const DepositCheckoutSchema = z
  .object({
    package: z.enum(PACKAGE_KEYS),
    buyerType: z.enum(["personal", "business"]).default("personal"),
    business: BusinessDetailsSchema.optional(),
    origin: z.string().url(),
    promoCode: z.string().trim().min(3).max(40).optional().or(z.literal("")),
    pickup: z.boolean().default(false),
    shippingAddress: ShippingAddressSchema.optional(),
    customerEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
    customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .refine((v) => v.pickup || v.shippingAddress, {
    message: "Shipping address is required unless pickup is selected",
    path: ["shippingAddress"],
  })
  .refine((v) => v.package === "home" || v.buyerType !== "business" || !!v.business, {
    message: "Clinic details are required for a business purchase",
    path: ["business"],
  });

export const BalanceCheckoutSchema = z.object({
  token: z.string().trim().min(10).max(120),
  path: z.enum(["full", "plan"]),
  origin: z.string().url(),
});

export const PromoSchema = z.object({
  package: z.enum(PACKAGE_KEYS),
  promoCode: z.string().trim().min(1).max(40),
});

export const EftOrderSchema = z.object({
  package: z.enum(PACKAGE_KEYS),
  buyerType: z.enum(["personal", "business"]).default("personal"),
  business: BusinessDetailsSchema.optional(),
  promoCode: z.string().trim().max(40).optional().or(z.literal("")),
  customerEmail: z.string().trim().email().max(160),
  customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
  pickup: z.boolean().default(false),
  shippingAddress: ShippingAddressSchema.optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
});

export const TokenSchema = z.object({ token: z.string().trim().min(10).max(120) });
export const FinalizeSchema = z.object({ sessionId: z.string().min(1) });

/* ----------------------------------------------------------------- shipping */

export type ShippingChoice = {
  region: string;
  label: string;
  amount: number;
  gstInclusive: boolean;
};

export async function loadShippingRateForCountry(
  country: string,
  scope: "kit" | "table",
  state?: string | null,
): Promise<ShippingChoice> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("shipping_rates")
    .select(
      "region, label, amount_cents, gst_inclusive, allowed_countries, allowed_states, applies_to, active, sort_order",
    )
    .eq("active", true)
    .gt("amount_cents", 0)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Could not load shipping rates");
  const iso = country.toUpperCase();
  const st = (state ?? "").trim().toUpperCase();
  const candidates = (data ?? []).filter(
    (r) =>
      (r.applies_to === scope || r.applies_to === "any") &&
      Array.isArray(r.allowed_countries) &&
      (r.allowed_countries as string[]).map((c) => c.toUpperCase()).includes(iso),
  );
  const match =
    candidates.find(
      (r) =>
        Array.isArray(r.allowed_states) &&
        (r.allowed_states as string[]).length > 0 &&
        !!st &&
        (r.allowed_states as string[]).map((c) => c.toUpperCase()).includes(st),
    ) ??
    candidates.find(
      (r) => !Array.isArray(r.allowed_states) || (r.allowed_states as string[]).length === 0,
    );
  if (!match) {
    throw new Error(
      scope === "table"
        ? "We can't freight the fitted table to that destination yet. Please contact us."
        : "We don't ship to that country yet.",
    );
  }
  return {
    region: match.region,
    label: match.label,
    amount: match.amount_cents,
    gstInclusive: match.gst_inclusive,
  };
}

export function addressToText(addr?: z.infer<typeof ShippingAddressSchema>) {
  if (!addr) return "Pickup, customer collects";
  return [
    addr.line1,
    addr.line2,
    `${addr.city} ${addr.state ?? ""} ${addr.postalCode}`.trim(),
    addr.country,
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------- promo */

export type AppliedPromo = {
  id: string;
  code: string;
  percentOff: number;
  amountDiscounted: number;
  payableAmount: number;
};

/** Promo discounts the balance, never the $100 order deposit. */
export async function resolvePromo(
  packageKey: PackageKey,
  rawCode: string | null,
): Promise<AppliedPromo | null> {
  const code = rawCode?.trim().toUpperCase() || null;
  if (!code) return null;
  const pkg = PACKAGES[packageKey];
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
  const amountDiscounted = Math.floor((pkg.listCents * promo.discount_percent) / 100);
  if (pkg.balanceCents - amountDiscounted < 50) {
    throw new Error("This promo code discount is too high for checkout");
  }
  return {
    id: promo.id,
    code: promo.code,
    percentOff: promo.discount_percent,
    amountDiscounted,
    payableAmount: pkg.listCents - amountDiscounted,
  };
}

/* ------------------------------------------------------- step 1: deposit */

export async function createDepositCheckout(data: z.infer<typeof DepositCheckoutSchema>) {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) throw new Error("Stripe is not configured");
  const stripe = new Stripe(secret);
  const pkg = PACKAGES[data.package as PackageKey];
  const addr = data.shippingAddress;

  const shipping: ShippingChoice = data.pickup
    ? { region: "pickup", label: "Customer collects (pickup)", amount: 0, gstInclusive: false }
    : await loadShippingRateForCountry(addr!.country, pkg.shippingScope, addr!.state);

  const promo = await resolvePromo(data.package as PackageKey, data.promoCode || null);

  const buyerType = pkg.personalOnly ? "personal" : data.buyerType;
  const { order } = await createOrderDraft({
    packageKey: data.package as PackageKey,
    buyerType,
    businessName: data.business?.businessName ?? null,
    abn: data.business?.abn || null,
    contactName: data.business?.contactName ?? addr?.name ?? null,
    contactEmail: data.business?.contactEmail || data.customerEmail || null,
    contactPhone: data.business?.contactPhone || data.customerPhone || null,
    pickup: data.pickup,
    shippingAddress: addressToText(addr),
    shipping,
    promo,
    paymentChannel: "card",
  });

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

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    payment_method_types: ["card"],
    mode: "payment",
    customer_creation: "always",
    phone_number_collection: { enabled: true },
    billing_address_collection: "required",
    return_url: `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    ...(stripeAddress && addr
      ? { payment_intent_data: { shipping: { name: addr.name, address: stripeAddress } } }
      : {}),
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `${pkg.label}, order deposit`,
            description: `Order deposit of ${money(ORDER_DEPOSIT_CENTS)} incl. GST for ${pkg.label}. Secures your order for 30 days. Shipping${
              shipping.amount > 0 ? ` of ${money(shipping.amount)}` : ""
            } and the balance are paid at the next step, and nothing ships until that clears.`,
          },
          unit_amount: ORDER_DEPOSIT_CENTS,
        },
        quantity: 1,
      },
    ],
    allow_promotion_codes: false,
    metadata: {
      stage: "deposit",
      order_id: order.id,
      order_number: order.order_number,
      package: order.package_key,
      buyer_type: order.buyer_type,
    },
  });

  if (!session.client_secret) throw new Error("Stripe did not return a client secret");

  await updateOrder(order.id, { stripe_deposit_session_id: session.id });
  await logOrderEvent(order.id, "deposit_checkout_opened", { stripeRef: session.id });

  return {
    clientSecret: session.client_secret,
    orderNumber: order.order_number,
    depositCents: ORDER_DEPOSIT_CENTS,
    appliedPromo: promo,
    shipping,
  };
}

/* --------------------------------------------------------- step 2: balance */

/**
 * One reusable Stripe Price per package for the plan monthlies, so plans are
 * visible and auditable in the Stripe dashboard rather than inline amounts.
 */
export async function ensureMonthlyPrice(stripe: Stripe, pkgKey: PackageKey): Promise<string> {
  const pkg = PACKAGES[pkgKey];
  const lookupKey = `resonabed_${pkgKey}_monthly_${pkg.plan.monthlyCents}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const product = await stripe.products.create({
    name: `${pkg.label}, monthly payment`,
    description: `${pkg.plan.months} monthly payments of ${money(
      pkg.plan.monthlyCents,
    )} incl. GST following the deposit balance.`,
    metadata: { package: pkgKey, purpose: "plan_monthly" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "aud",
    unit_amount: pkg.plan.monthlyCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: { package: pkgKey },
  });
  return price.id;
}

/** Same calendar day next month, so cycles never drift on a 30 day guess. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // clamp to end of shorter month
  return d;
}

export type OrderSummary = {
  orderNumber: string;
  state: string;
  packageKey: string;
  packageLabel: string;
  buyerType: string;
  contactName: string | null;
  contactEmail: string | null;
  shippingLabel: string | null;
  shippingCents: number;
  pickup: boolean;
  depositCents: number;
  balanceCents: number;
  promoCode: string | null;
  discountCents: number;
  plan: { depositBalanceCents: number; monthlyCents: number; months: number; totalCents: number };
  expiresAt: string | null;
  paidTotalCents: number;
  paymentsMade: number;
  path: string | null;
};

export function summariseOrder(order: KitOrderRow): OrderSummary {
  const months = order.plan_months ?? 10;
  const monthly = order.plan_monthly_cents ?? 0;
  const planDeposit = order.plan_deposit_balance_cents ?? 0;
  return {
    orderNumber: order.order_number,
    state: order.state,
    packageKey: order.package_key,
    packageLabel: order.package_label,
    buyerType: order.buyer_type,
    contactName: order.contact_name,
    contactEmail: order.contact_email,
    shippingLabel: order.shipping_label,
    shippingCents: order.shipping_cents,
    pickup: order.pickup,
    depositCents: order.deposit_cents,
    balanceCents: order.balance_cents,
    promoCode: order.promo_code,
    discountCents: order.discount_cents,
    plan: {
      depositBalanceCents: planDeposit,
      monthlyCents: monthly,
      months,
      totalCents: order.deposit_cents + planDeposit + monthly * months,
    },
    expiresAt: order.expires_at,
    paidTotalCents: order.collected_cents,
    paymentsMade: order.payments_made,
    path: order.path,
  };
}

export async function loadOrderForToken(token: string): Promise<OrderSummary> {
  const order = await getOrderByToken(token);
  if (!order) throw new Error("We couldn't find that order. Please use the latest link we emailed you.");
  return summariseOrder(order);
}

export async function createBalanceCheckout(data: z.infer<typeof BalanceCheckoutSchema>) {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) throw new Error("Stripe is not configured");
  const stripe = new Stripe(secret);

  const order = await getOrderByToken(data.token);
  if (!order) throw new Error("We couldn't find that order");
  if (order.state !== "deposit_paid") {
    throw new Error(
      order.state === "draft"
        ? "This order is still waiting on its deposit."
        : "This order has already moved past the balance step.",
    );
  }
  const pkgKey = order.package_key as PackageKey;
  const pkg = PACKAGES[pkgKey];
  if (!pkg) throw new Error("Unknown package on this order");

  const baseMetadata = {
    order_id: order.id,
    order_number: order.order_number,
    package: order.package_key,
    buyer_type: order.buyer_type,
  };
  const returnUrl = `${data.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`;

  // Shipping was quoted and locked at deposit time, and is charged here, once.
  // The stored figure is used as-is; rates are never recalculated at this step.
  const shippingDue = order.shipping_charged_at ? 0 : order.shipping_cents;
  const shippingLineItem =
    shippingDue > 0
      ? [
          {
            price_data: {
              currency: "aud" as const,
              product_data: {
                name: `Shipping, ${order.shipping_label ?? order.shipping_region ?? "as quoted"}`,
                description: `Flat-rate shipping quoted with your deposit (${
                  order.shipping_gst_inclusive ? "incl. GST" : "GST-free export"
                }). Charged once, here.`,
              },
              unit_amount: shippingDue,
            },
            quantity: 1,
          },
        ]
      : [];

  if (data.path === "full") {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      mode: "payment",
      ...(order.stripe_customer_id ? { customer: order.stripe_customer_id } : {}),
      return_url: returnUrl,
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `${pkg.label}, balance`,
              description: `Remaining balance for order ${order.order_number}. Deposit of ${money(
                order.deposit_cents,
              )} already paid.${
                shippingDue > 0 ? " Shipping is charged with this payment." : ""
              }${order.promo_code ? ` Promo ${order.promo_code} applied.` : ""}`,
            },
            unit_amount: order.balance_cents,
          },
          quantity: 1,
        },
        ...shippingLineItem,
      ],
      allow_promotion_codes: false,
      metadata: { ...baseMetadata, stage: "balance_full" },
    });
    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    await updateOrder(order.id, { stripe_balance_session_id: session.id });
    await logOrderEvent(order.id, "balance_checkout_opened", {
      stripeRef: session.id,
      detail: { path: "full", amount_cents: order.balance_cents, shipping_cents: shippingDue },
    });
    return { clientSecret: session.client_secret, path: "full" as const };
  }

  // Plan: deposit balance now, then exactly `months` monthly cycles. The trial
  // keeps the first monthly off today's invoice, so the count stays exact.
  const priceId = await ensureMonthlyPrice(stripe, pkgKey);
  const trialEnd = addMonths(new Date(), 1);

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    payment_method_types: ["card"],
    mode: "subscription",
    ...(order.stripe_customer_id ? { customer: order.stripe_customer_id } : {}),
    return_url: returnUrl,
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `${pkg.label}, deposit balance`,
            description: `Deposit balance for order ${order.order_number}, followed by ${pkg.plan.months} monthly payments of ${money(
              pkg.plan.monthlyCents,
            )}.`,
          },
          unit_amount: order.plan_deposit_balance_cents ?? pkg.plan.depositBalanceCents,
        },
        quantity: 1,
      },
      { price: priceId, quantity: 1 },
    ],
    subscription_data: {
      description: `${pkg.label}, ${pkg.plan.months} month payment plan for order ${order.order_number}`,
      trial_end: Math.floor(trialEnd.getTime() / 1000),
      metadata: { ...baseMetadata, months: String(pkg.plan.months) },
    },
    allow_promotion_codes: false,
    metadata: { ...baseMetadata, stage: "balance_plan" },
  });
  if (!session.client_secret) throw new Error("Stripe did not return a client secret");
  await updateOrder(order.id, { stripe_balance_session_id: session.id });
  await logOrderEvent(order.id, "balance_checkout_opened", {
    stripeRef: session.id,
    detail: { path: "plan", months: pkg.plan.months },
  });
  return { clientSecret: session.client_secret, path: "plan" as const };
}

/* ------------------------------------------------------------- EFT deposit */

export async function createEftDepositOrder(data: z.infer<typeof EftOrderSchema>) {
  const addr = data.shippingAddress;
  if (!data.pickup && !addr) {
    throw new Error("Shipping address is required unless pickup is selected");
  }
  const pkg = PACKAGES[data.package as PackageKey];
  const shipping: ShippingChoice = data.pickup
    ? { region: "pickup", label: "Customer collects (pickup)", amount: 0, gstInclusive: false }
    : await loadShippingRateForCountry(addr!.country, pkg.shippingScope, addr!.state);

  const promo = await resolvePromo(data.package as PackageKey, data.promoCode || null);

  const { order, token } = await createOrderDraft({
    packageKey: data.package as PackageKey,
    buyerType: pkg.personalOnly ? "personal" : data.buyerType,
    businessName: data.business?.businessName ?? null,
    abn: data.business?.abn || null,
    contactName: (data.business?.contactName || data.customerName || addr?.name || data.customerEmail).slice(0, 120),
    contactEmail: data.business?.contactEmail || data.customerEmail,
    contactPhone: data.business?.contactPhone || data.customerPhone || null,
    pickup: data.pickup,
    shippingAddress: addressToText(addr),
    shipping,
    promo,
    paymentChannel: "eft",
  });

  const { createEftDepositInvoice } = await import("@/lib/eft-order.server");
  const invoice = await createEftDepositInvoice(order, token);
  return invoice;
}

/* ------------------------------------------------------- finalise / EFT bal */

/**
 * Repeats the webhook's idempotent transition when the buyer lands back on
 * /order/success, so a slow webhook never leaves them without their next step.
 */
export async function finalizeSession(sessionId: string) {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) throw new Error("Stripe is not configured");
  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const { fulfilCheckoutSession } = await import("@/lib/order-fulfilment.server");
  return await fulfilCheckoutSession(session);
}

/** EFT buyers settle the balance in full by transfer. Plans require a card. */
export async function requestEftBalance(token: string) {
  const order = await getOrderByToken(token);
  if (!order) throw new Error("We couldn't find that order");
  if (order.state !== "deposit_paid") {
    throw new Error("This order is not waiting on a balance payment");
  }
  const { createEftBalanceInvoice } = await import("@/lib/eft-order.server");
  const invoice = await createEftBalanceInvoice(order);
  await updateOrder(order.id, { payment_channel: "eft", path: "full" });
  await logOrderEvent(order.id, "balance_eft_invoice_raised", {
    detail: { invoice: invoice.invoiceNumber, amount_cents: order.balance_cents },
  });
  return { ...invoice, balanceCents: order.balance_cents, orderNumber: order.order_number };
}
