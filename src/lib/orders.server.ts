/**
 * Deposit-first order engine. `kit_orders` is the source of truth for what a
 * website order is and what it is owed; Stripe is only the payment rail.
 *
 * States:
 *   draft -> deposit_paid -> balance_paid -> fulfilled
 *                         -> plan_active  -> fulfilled -> plan_completed
 *         -> expired | cancelled | refunded | defaulted (Phase 3)
 *
 * Fulfilment (access code, onboarding queue, shipping flags) happens ONLY from
 * balance_paid or plan_active. A paid $100 deposit ships nothing, ever.
 */
import {
  PACKAGES,
  ORDER_DEPOSIT_CENTS,
  gstOf,
  isPackageKey,
  type PackageKey,
} from "@/lib/packages";

export const SITE_URL = "https://resonabed.com";

export type OrderState =
  | "draft"
  | "deposit_paid"
  | "balance_paid"
  | "plan_active"
  | "fulfilled"
  | "plan_completed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "arrears"
  | "defaulted";

/** States in which the physical kit and app access may be released. */
const FULFILLABLE_STATES = new Set<OrderState>(["balance_paid", "plan_active"]);

export type KitOrderRow = {
  id: string;
  order_number: string;
  state: OrderState;
  package_key: string;
  package_label: string;
  buyer_type: string;
  business_name: string | null;
  abn: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  pickup: boolean;
  shipping_address: string | null;
  shipping_region: string | null;
  shipping_label: string | null;
  shipping_cents: number;
  shipping_gst_inclusive: boolean;
  shipping_charged_at: string | null;
  promo_code: string | null;
  promo_code_id: string | null;
  promo_percent: number | null;
  discount_cents: number;
  payment_channel: string;
  path: string | null;
  list_cents: number;
  deposit_cents: number;
  balance_cents: number;
  plan_deposit_balance_cents: number | null;
  plan_monthly_cents: number | null;
  plan_months: number | null;
  collected_cents: number;
  contract_cents: number;
  gst_cents: number;
  ships_kit: boolean;
  ships_table: boolean;
  stripe_customer_id: string | null;
  stripe_deposit_session_id: string | null;
  stripe_deposit_payment_intent: string | null;
  stripe_balance_session_id: string | null;
  stripe_balance_payment_intent: string | null;
  stripe_subscription_id: string | null;
  payments_made: number;
  payments_due: number;
  arrears_since: string | null;
  /* Phase 3: arrears, dunning and the proportionate default gate. */
  first_failure_at: string | null;
  failure_count: number;
  prior_failure_count: number;
  dunning_stage: number;
  last_dunning_at: string | null;
  dunning_paused_until: string | null;
  arrears_entered_at: string | null;
  defaulted_at: string | null;
  wind_down_at: string | null;
  access_level: "full" | "limited" | "suspended";
  access_applied_at: string | null;
  owed_cents: number;
  write_off_cents: number | null;
  written_off_at: string | null;
  card_expiry_warned_at: string | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  plan_started_at: string | null;
  plan_completed_at: string | null;
  fulfilled_at: string | null;
  expires_at: string | null;
  refunded_at: string | null;
  reminder_7_sent_at: string | null;
  reminder_25_sent_at: string | null;
  notes: string | null;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------------------------------------------ tokens */

const HEX = "0123456789abcdef";

export function generateOrderToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

export async function hashOrderToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(`resonabed-order:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => HEX[b >> 4] + HEX[b & 15])
    .join("");
}

export function balanceUrl(token: string, origin?: string) {
  return `${origin ?? SITE_URL}/order/balance/${token}`;
}

/* ------------------------------------------------------------------ events */

export async function logOrderEvent(
  orderId: string,
  eventType: string,
  opts: {
    fromState?: string | null;
    toState?: string | null;
    stripeRef?: string | null;
    detail?: Record<string, unknown>;
  } = {},
) {
  const db = await admin();
  await db.from("kit_order_events").insert({
    order_id: orderId,
    event_type: eventType,
    from_state: opts.fromState ?? null,
    to_state: opts.toState ?? null,
    stripe_ref: opts.stripeRef ?? null,
    detail: (opts.detail ?? {}) as never,
  });
}

/* ------------------------------------------------------------------ create */

export type CreateOrderInput = {
  packageKey: PackageKey;
  buyerType: "personal" | "business";
  businessName?: string | null;
  abn?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  pickup: boolean;
  shippingAddress?: string | null;
  shipping: { region: string; label: string; amount: number; gstInclusive: boolean };
  promo?: { id: string; code: string; percentOff: number; amountDiscounted: number } | null;
  paymentChannel: "card" | "eft";
};

export async function createOrderDraft(
  input: CreateOrderInput,
): Promise<{ order: KitOrderRow; token: string }> {
  const db = await admin();
  const pkg = PACKAGES[input.packageKey];
  const token = generateOrderToken();
  const tokenHash = await hashOrderToken(token);

  const { data: numberRow, error: numErr } = await db.rpc("next_kit_order_number");
  if (numErr) throw new Error(numErr.message);

  const discount = input.promo?.amountDiscounted ?? 0;
  const buyerType = pkg.personalOnly ? "personal" : input.buyerType;

  const { data, error } = await db
    .from("kit_orders")
    .insert({
      order_number: numberRow as unknown as string,
      token_hash: tokenHash,
      state: "draft",
      package_key: pkg.key,
      package_label: pkg.label,
      buyer_type: buyerType,
      business_name: input.businessName ?? null,
      abn: input.abn ?? null,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail?.trim().toLowerCase() ?? null,
      contact_phone: input.contactPhone ?? null,
      pickup: input.pickup,
      shipping_address: input.shippingAddress ?? null,
      shipping_region: input.shipping.region,
      shipping_label: input.shipping.label,
      shipping_cents: input.shipping.amount,
      shipping_gst_inclusive: input.shipping.gstInclusive,
      promo_code: input.promo?.code ?? null,
      promo_code_id: input.promo?.id ?? null,
      promo_percent: input.promo?.percentOff ?? null,
      discount_cents: discount,
      payment_channel: input.paymentChannel,
      list_cents: pkg.listCents,
      deposit_cents: ORDER_DEPOSIT_CENTS,
      balance_cents: Math.max(0, pkg.balanceCents - discount),
      plan_deposit_balance_cents: pkg.plan.depositBalanceCents,
      plan_monthly_cents: pkg.plan.monthlyCents,
      plan_months: pkg.plan.months,
      ships_kit: true,
      ships_table: pkg.shipsTable,
      contract_cents: pkg.listCents - discount + input.shipping.amount,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const order = data as unknown as KitOrderRow;
  await logOrderEvent(order.id, "order_created", {
    toState: "draft",
    detail: { package: pkg.key, channel: input.paymentChannel },
  });
  return { order, token };
}

/* ------------------------------------------------------------------- reads */

export async function getOrderById(id: string): Promise<KitOrderRow | null> {
  const db = await admin();
  const { data } = await db.from("kit_orders").select("*").eq("id", id).maybeSingle();
  return (data as unknown as KitOrderRow) ?? null;
}

export async function getOrderByToken(token: string): Promise<KitOrderRow | null> {
  const db = await admin();
  const tokenHash = await hashOrderToken(token);
  const { data } = await db
    .from("kit_orders")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  return (data as unknown as KitOrderRow) ?? null;
}

export async function getOrderByStripeRef(
  column:
    | "stripe_deposit_session_id"
    | "stripe_balance_session_id"
    | "stripe_subscription_id"
    | "stripe_deposit_payment_intent",
  value: string,
): Promise<KitOrderRow | null> {
  const db = await admin();
  const { data } = await db.from("kit_orders").select("*").eq(column, value).maybeSingle();
  return (data as unknown as KitOrderRow) ?? null;
}

export async function updateOrder(id: string, patch: Record<string, unknown>) {
  const db = await admin();
  const { data, error } = await db
    .from("kit_orders")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as KitOrderRow;
}

/* -------------------------------------------------------------- transitions */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The $100 deposit has cleared. Shipping is quoted and locked at this point but
 * charged with the balance. This secures the order for 30 days and fulfils
 * NOTHING.
 */
export async function markDepositPaid(
  order: KitOrderRow,
  opts: {
    stripeSessionId?: string | null;
    paymentIntent?: string | null;
    customerId?: string | null;
    amountCents: number;
    contact?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
    };
  },
): Promise<{ order: KitOrderRow; balanceToken: string | null }> {
  if (order.state !== "draft") return { order, balanceToken: null }; // idempotent

  const now = new Date();
  const updated = await updateOrder(order.id, {
    state: "deposit_paid",
    deposit_paid_at: now.toISOString(),
    expires_at: new Date(now.getTime() + THIRTY_DAYS_MS).toISOString(),
    collected_cents: opts.amountCents,
    stripe_deposit_session_id: opts.stripeSessionId ?? order.stripe_deposit_session_id,
    stripe_deposit_payment_intent: opts.paymentIntent ?? order.stripe_deposit_payment_intent,
    stripe_customer_id: opts.customerId ?? order.stripe_customer_id,
    contact_name: opts.contact?.name ?? order.contact_name,
    contact_email: (opts.contact?.email ?? order.contact_email)?.toLowerCase() ?? null,
    contact_phone: opts.contact?.phone ?? order.contact_phone,
    shipping_address: order.shipping_address ?? opts.contact?.address ?? null,
  });

  await logOrderEvent(order.id, "deposit_paid", {
    fromState: order.state,
    toState: "deposit_paid",
    stripeRef: opts.stripeSessionId ?? null,
    detail: { amount_cents: opts.amountCents },
  });

  const balanceToken = await sendDepositReceivedEmail(updated);
  return { order: updated, balanceToken };
}

/** Balance cleared in full. Fulfilment follows. */
export async function markBalancePaid(
  order: KitOrderRow,
  opts: { stripeSessionId?: string | null; paymentIntent?: string | null; amountCents: number },
): Promise<KitOrderRow> {
  if (order.state !== "deposit_paid") return order;
  const updated = await updateOrder(order.id, {
    state: "balance_paid",
    path: "full",
    balance_paid_at: new Date().toISOString(),
    // Shipping was quoted at deposit time and is collected with this payment.
    shipping_charged_at: order.shipping_charged_at ?? new Date().toISOString(),
    collected_cents: order.collected_cents + opts.amountCents,
    contract_cents: order.deposit_cents + order.shipping_cents + order.balance_cents,
    stripe_balance_session_id: opts.stripeSessionId ?? order.stripe_balance_session_id,
    stripe_balance_payment_intent: opts.paymentIntent ?? order.stripe_balance_payment_intent,
  });
  await logOrderEvent(order.id, "balance_paid", {
    fromState: order.state,
    toState: "balance_paid",
    stripeRef: opts.stripeSessionId ?? null,
    detail: { amount_cents: opts.amountCents },
  });
  return updated;
}

/** Deposit balance cleared and the 10-month plan is live. Fulfilment follows. */
export async function markPlanActive(
  order: KitOrderRow,
  opts: {
    stripeSessionId?: string | null;
    subscriptionId: string;
    amountCents: number;
  },
): Promise<KitOrderRow> {
  if (order.state !== "deposit_paid") return order;
  const months = order.plan_months ?? 10;
  const monthly = order.plan_monthly_cents ?? 0;
  const updated = await updateOrder(order.id, {
    state: "plan_active",
    path: "plan",
    plan_started_at: new Date().toISOString(),
    // Shipping is collected in full with the deposit balance, not spread.
    shipping_charged_at: order.shipping_charged_at ?? new Date().toISOString(),
    collected_cents: order.collected_cents + opts.amountCents,
    contract_cents:
      order.deposit_cents +
      order.shipping_cents +
      (order.plan_deposit_balance_cents ?? 0) +
      monthly * months,
    payments_due: months,
    payments_made: 0,
    stripe_balance_session_id: opts.stripeSessionId ?? order.stripe_balance_session_id,
    stripe_subscription_id: opts.subscriptionId,
  });
  await logOrderEvent(order.id, "plan_started", {
    fromState: order.state,
    toState: "plan_active",
    stripeRef: opts.subscriptionId,
    detail: { amount_cents: opts.amountCents, months },
  });
  return updated;
}

/* ------------------------------------------------------------- fulfilment */

export type OrderFulfilmentResult = {
  fulfilled: boolean;
  refusedBecause?: string;
  buyerType: "personal" | "business";
  codeEmail: string | null;
  queuedForOnboarding: boolean;
};

/**
 * The one and only release point for product. Hard-refuses unless the order is
 * in balance_paid or plan_active, so a deposit-only order can never ship, never
 * gets an access code and never reaches the onboarding queue.
 */
export async function fulfilOrder(orderId: string): Promise<OrderFulfilmentResult> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const buyerType = order.buyer_type === "business" ? "business" : "personal";

  if (order.fulfilled_at) {
    return { fulfilled: true, buyerType, codeEmail: null, queuedForOnboarding: false };
  }

  if (!FULFILLABLE_STATES.has(order.state)) {
    await logOrderEvent(order.id, "fulfilment_refused", {
      fromState: order.state,
      detail: { reason: "state_not_fulfillable" },
    });
    console.warn(
      `Fulfilment refused for order ${order.order_number}: state is ${order.state}, not balance_paid/plan_active`,
    );
    return {
      fulfilled: false,
      refusedBecause: `state:${order.state}`,
      buyerType,
      codeEmail: null,
      queuedForOnboarding: false,
    };
  }

  const email = order.contact_email;
  if (!email) {
    await logOrderEvent(order.id, "fulfilment_refused", { detail: { reason: "no_email" } });
    return {
      fulfilled: false,
      refusedBecause: "no_email",
      buyerType,
      codeEmail: null,
      queuedForOnboarding: false,
    };
  }

  // Books first, so every released order is in the ledger.
  try {
    const { recordOrderInvoice } = await import("@/lib/kit-invoicing.server");
    await recordOrderInvoice(order);
  } catch (err) {
    console.error("Failed to record kit invoice for order", order.order_number, err);
  }

  let codeEmail: string | null = null;
  let queuedForOnboarding = false;

  if (buyerType === "business") {
    const { recordOnboardingOrder } = await import("@/lib/onboarding.server");
    const queued = await recordOnboardingOrder({
      source: "order",
      sourceRef: order.order_number,
      businessName: order.business_name,
      abn: order.abn,
      contactName: order.contact_name,
      contactEmail: email,
      contactPhone: order.contact_phone,
      packageKey: order.package_key,
      plan: order.path === "plan" ? "installments" : "full",
      shippingAddress: order.shipping_address,
      amountCents: order.contract_cents,
      notes: `Order ${order.order_number}, balance cleared.`,
    });
    queuedForOnboarding = !queued.alreadyExisted;
  } else {
    const { issueAccessCode } = await import("@/lib/home-access.server");
    const issued = await issueAccessCode({
      buyerEmail: email,
      buyerName: order.contact_name,
      buyerPhone: order.contact_phone,
      packageKey: order.package_key,
      source: "order",
      sourceRef: order.order_number,
      buyerType: "personal",
    });
    codeEmail = issued.buyerEmail;
  }

  await updateOrder(order.id, {
    state: "fulfilled",
    fulfilled_at: new Date().toISOString(),
  });
  await logOrderEvent(order.id, "fulfilled", {
    fromState: order.state,
    toState: "fulfilled",
    detail: {
      buyer_type: buyerType,
      ships_kit: order.ships_kit,
      ships_table: order.ships_table,
    },
  });

  return { fulfilled: true, buyerType, codeEmail, queuedForOnboarding };
}

/* -------------------------------------------------------------- plan cycles */

/**
 * A monthly plan invoice cleared. Stops the plan dead on the 10th, and — the
 * Phase 3 rule that matters most — a paying customer is restored to full access
 * in the same path, instantly, before anything else happens.
 */
export async function recordPlanPayment(
  order: KitOrderRow,
  opts: { invoiceId: string; amountCents: number; stripeSecret: string },
): Promise<{ paymentsMade: number; completed: boolean; restored: boolean }> {
  const months = order.plan_months ?? 10;
  const paymentsMade = Math.min(months, order.payments_made + 1);

  let current = await updateOrder(order.id, {
    payments_made: paymentsMade,
    collected_cents: order.collected_cents + opts.amountCents,
  });
  await logOrderEvent(order.id, "plan_payment", {
    stripeRef: opts.invoiceId,
    detail: { payment: paymentsMade, of: months, amount_cents: opts.amountCents },
  });

  // Recovery first: a successful payment always clears arrears and returns
  // access, whether it came from a retry, a catch-up or the normal cycle.
  const wasBehind =
    !!order.arrears_since || order.state === "arrears" || order.state === "defaulted";
  if (wasBehind) {
    const { restorePlanAfterPayment } = await import("@/lib/plan-arrears.server");
    current = await restorePlanAfterPayment(current);
  }

  if (paymentsMade < months) return { paymentsMade, completed: false, restored: wasBehind };

  // Exactly `months` cycle payments taken: end the subscription now, by count,
  // never by a date approximation.
  if (current.stripe_subscription_id) {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(opts.stripeSecret);
    try {
      await stripe.subscriptions.cancel(current.stripe_subscription_id);
    } catch (err) {
      console.error("Could not cancel completed plan subscription", err);
    }
  }
  await updateOrder(order.id, {
    state: "plan_completed",
    plan_completed_at: new Date().toISOString(),
  });
  await logOrderEvent(order.id, "plan_completed", {
    fromState: current.state,
    toState: "plan_completed",
    detail: { payments: paymentsMade },
  });
  return { paymentsMade, completed: true, restored: wasBehind };
}

/** A failed monthly. Delegates to the arrears engine; no access change here. */
export async function recordPlanPaymentFailure(
  order: KitOrderRow,
  invoiceId: string,
  amountDueCents = 0,
) {
  const { recordPlanPaymentFailure: handle } = await import("@/lib/plan-arrears.server");
  return handle(order, invoiceId, amountDueCents);
}

/* ------------------------------------------------------ expiry and refunds */

export async function markRefunded(order: KitOrderRow, amountCents: number, reason: string) {
  await updateOrder(order.id, {
    state: "refunded",
    refunded_at: new Date().toISOString(),
    refund_cents: amountCents,
  });
  await logOrderEvent(order.id, "refunded", {
    fromState: order.state,
    toState: "refunded",
    detail: { amount_cents: amountCents, reason },
  });
}

/**
 * Refunds the order deposit. Shipping is never charged at deposit stage, so a
 * deposit-stage refund has no shipping component. Never available once the
 * order has been fulfilled.
 */
export async function refundOrderDeposit(
  orderId: string,
  reason: string,
): Promise<{ refundedCents: number }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.fulfilled_at || order.state === "fulfilled" || order.state === "plan_completed") {
    throw new Error("This order has already been fulfilled and cannot be refunded here");
  }
  if (order.state === "refunded") return { refundedCents: order.deposit_cents };

  const amount = order.deposit_cents + (order.shipping_charged_at ? order.shipping_cents : 0);

  if (order.payment_channel === "card" && order.stripe_deposit_payment_intent) {
    const secret = process.env["STRIPE_SECRET_KEY"];
    if (!secret) throw new Error("Stripe is not configured");
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    await stripe.refunds.create({
      payment_intent: order.stripe_deposit_payment_intent,
      amount,
      reason: "requested_by_customer",
    });
  }

  await markRefunded(order, amount, reason);
  return { refundedCents: amount };
}

/**
 * Daily sweep. Cleans abandoned drafts, expires unpaid-balance orders after 30
 * days and sends the day 7 / day 25 nudges. Idempotent, safe to run often.
 */
export async function tickOrders(): Promise<{
  draftsCleaned: number;
  expired: number;
  remindersSent: number;
}> {
  const db = await admin();
  const now = Date.now();

  // 1. Abandoned drafts: checkout opened, deposit never paid.
  const draftCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: drafts } = await db
    .from("kit_orders")
    .select("id, order_number")
    .eq("state", "draft")
    .lt("created_at", draftCutoff)
    .limit(500);
  let draftsCleaned = 0;
  for (const d of drafts ?? []) {
    await db.from("kit_orders").delete().eq("id", d.id);
    draftsCleaned += 1;
  }

  // 2. Deposit paid but no balance within 30 days: expire and flag to admin.
  const { data: stale } = await db
    .from("kit_orders")
    .select("*")
    .eq("state", "deposit_paid")
    .lt("expires_at", new Date(now).toISOString())
    .limit(200);
  let expired = 0;
  for (const row of (stale ?? []) as unknown as KitOrderRow[]) {
    await updateOrder(row.id, { state: "expired", expired_at: new Date().toISOString() });
    await logOrderEvent(row.id, "expired", {
      fromState: "deposit_paid",
      toState: "expired",
      detail: { note: "30 day deposit hold elapsed, deposit refundable by admin" },
    });
    expired += 1;
  }

  // 3. Nudges at day 7 and day 25 of the hold.
  const { data: holding } = await db
    .from("kit_orders")
    .select("*")
    .eq("state", "deposit_paid")
    .limit(200);
  let remindersSent = 0;
  for (const row of (holding ?? []) as unknown as KitOrderRow[]) {
    if (!row.deposit_paid_at || !row.contact_email) continue;
    const ageDays = (now - new Date(row.deposit_paid_at).getTime()) / (24 * 60 * 60 * 1000);
    const stage = ageDays >= 25 ? 25 : ageDays >= 7 ? 7 : null;
    if (!stage) continue;
    if (stage === 7 && row.reminder_7_sent_at) continue;
    if (stage === 25 && row.reminder_25_sent_at) continue;
    const sent = await sendBalanceReminderEmail(row, stage);
    if (!sent) continue;
    await updateOrder(row.id, {
      [stage === 7 ? "reminder_7_sent_at" : "reminder_25_sent_at"]: new Date().toISOString(),
    });
    remindersSent += 1;
  }

  return { draftsCleaned, expired, remindersSent };
}

/* ------------------------------------------------------------------ emails */

/**
 * The balance link is the only way back into an order, so the raw token is
 * never stored. It is minted once, emailed once, and re-minted on a resend.
 */
export async function mintNewOrderToken(orderId: string): Promise<string> {
  const token = generateOrderToken();
  await updateOrder(orderId, { token_hash: await hashOrderToken(token) });
  return token;
}

async function sendOrderEmail(
  template: "order-deposit-received" | "order-balance-reminder",
  order: KitOrderRow,
  extra: Record<string, unknown>,
): Promise<string | null> {
  if (!order.contact_email) return null;
  try {
    const token = await mintNewOrderToken(order.id);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail(template, order.contact_email, {
      templateData: {
        recipientName: order.contact_name,
        orderNumber: order.order_number,
        packageLabel: order.package_label,
        balanceUrl: balanceUrl(token),
        balanceAmount: order.balance_cents,
        planDepositBalance: order.plan_deposit_balance_cents,
        planMonthly: order.plan_monthly_cents,
        planMonths: order.plan_months,
        expiresAt: order.expires_at,
        shippingAmount: order.shipping_charged_at ? 0 : order.shipping_cents,
        ...extra,
      },
      idempotencyKey: `${template}:${order.order_number}:${extra["stage"] ?? "initial"}`,
    });
    return token;
  } catch (err) {
    console.error("Order email failed", template, order.order_number, err);
    return null;
  }
}

export async function sendDepositReceivedEmail(order: KitOrderRow) {
  return sendOrderEmail("order-deposit-received", order, {});
}

export async function sendBalanceReminderEmail(order: KitOrderRow, stage: number) {
  return sendOrderEmail("order-balance-reminder", order, { stage });
}

/* ------------------------------------------------------------------ pricing */

export function orderGstCents(order: KitOrderRow) {
  const collectedShipping = order.shipping_charged_at ? order.shipping_cents : 0;
  const taxable = order.collected_cents - (order.shipping_gst_inclusive ? 0 : collectedShipping);
  return gstOf(Math.max(0, taxable));
}

export function packageForOrder(order: KitOrderRow) {
  return isPackageKey(order.package_key) ? PACKAGES[order.package_key as PackageKey] : null;
}
