/**
 * Turns Stripe events into order state transitions, and releases product only
 * when the order genuinely reaches a fulfillable state.
 *
 * Nothing here fulfils on "a Stripe session completed". The $100 order deposit
 * completes a Stripe session too, and it must ship nothing.
 */
import type Stripe from "stripe";
import {
  fulfilOrder,
  getOrderById,
  getOrderByStripeRef,
  markBalancePaid,
  markDepositPaid,
  markPlanActive,
  markRefunded,
  recordPlanPayment,
  recordPlanPaymentFailure,
  type KitOrderRow,
} from "@/lib/orders.server";

export type FulfilmentResult = {
  stage: "deposit" | "balance_full" | "balance_plan" | "unknown";
  orderNumber: string | null;
  state: string | null;
  buyerType: "personal" | "business";
  /** Email the home access code went to, personal buyers only. */
  codeEmail: string | null;
  queuedForOnboarding: boolean;
  /** Fresh private balance link, returned only right after a deposit. */
  balanceToken: string | null;
};

function meta(session: Stripe.Checkout.Session, key: string): string | null {
  const v = session.metadata?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function resolveOrder(session: Stripe.Checkout.Session): Promise<KitOrderRow | null> {
  const orderId = meta(session, "order_id");
  if (orderId) {
    const byId = await getOrderById(orderId);
    if (byId) return byId;
  }
  return (
    (await getOrderByStripeRef("stripe_deposit_session_id", session.id)) ??
    (await getOrderByStripeRef("stripe_balance_session_id", session.id))
  );
}

async function recordPromoRedemption(order: KitOrderRow, sessionId: string) {
  if (!order.promo_code_id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("promo_code_redemptions").insert({
    promo_code_id: order.promo_code_id,
    stripe_session_id: sessionId,
    amount_discounted_cents: order.discount_cents,
  });
  if (error && error.code !== "23505") return;
  if (error) return;
  const { data: promo } = await supabaseAdmin
    .from("promo_codes")
    .select("times_redeemed")
    .eq("id", order.promo_code_id)
    .single();
  if (promo) {
    await supabaseAdmin
      .from("promo_codes")
      .update({ times_redeemed: (promo.times_redeemed as number) + 1 })
      .eq("id", order.promo_code_id);
  }
}

/** Idempotent handler for checkout.session.completed, used by webhook + success page. */
export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<FulfilmentResult> {
  const stage = (meta(session, "stage") ?? "unknown") as FulfilmentResult["stage"];
  const order = await resolveOrder(session);

  const empty: FulfilmentResult = {
    stage,
    orderNumber: order?.order_number ?? null,
    state: order?.state ?? null,
    buyerType: order?.buyer_type === "business" ? "business" : "personal",
    codeEmail: null,
    queuedForOnboarding: false,
    balanceToken: null,
  };

  if (!order) {
    console.error("Stripe session with no matching order", session.id, session.metadata);
    return empty;
  }

  const paid =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";

  if (stage === "deposit") {
    if (!paid) return empty;
    const details = session.customer_details;
    const result = await markDepositPaid(order, {
      stripeSessionId: session.id,
      paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      customerId: typeof session.customer === "string" ? session.customer : null,
      amountCents: session.amount_total ?? order.deposit_cents,
      contact: {
        name: order.contact_name ?? details?.name ?? null,
        email: order.contact_email ?? details?.email ?? null,
        phone: order.contact_phone ?? details?.phone ?? null,
      },
    });
    // Deliberately no fulfilment here. A deposit ships nothing.
    return {
      ...empty,
      state: result.order.state,
      balanceToken: result.balanceToken,
    };
  }

  if (stage === "balance_full") {
    if (!paid) return empty;
    const updated = await markBalancePaid(order, {
      stripeSessionId: session.id,
      paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      amountCents: session.amount_total ?? order.balance_cents + order.shipping_cents,
    });
    await recordPromoRedemption(updated, session.id);
    const fulfilment = await fulfilOrder(updated.id);
    return {
      ...empty,
      state: fulfilment.fulfilled ? "fulfilled" : updated.state,
      buyerType: fulfilment.buyerType,
      codeEmail: fulfilment.codeEmail,
      queuedForOnboarding: fulfilment.queuedForOnboarding,
    };
  }

  if (stage === "balance_plan") {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return empty;
    const updated = await markPlanActive(order, {
      stripeSessionId: session.id,
      subscriptionId,
      amountCents:
        session.amount_total ?? (order.plan_deposit_balance_cents ?? 0) + order.shipping_cents,
    });
    const fulfilment = await fulfilOrder(updated.id);
    return {
      ...empty,
      state: fulfilment.fulfilled ? "fulfilled" : updated.state,
      buyerType: fulfilment.buyerType,
      codeEmail: fulfilment.codeEmail,
      queuedForOnboarding: fulfilment.queuedForOnboarding,
    };
  }

  console.warn("Stripe session with unknown stage, ignoring", session.id, stage);
  return empty;
}

/** invoice.paid on a plan subscription: counts a monthly and stops at exactly N. */
export async function handlePlanInvoicePaid(invoice: Stripe.Invoice, stripeSecret: string) {
  const subscriptionId =
    typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
      ? ((invoice as unknown as { subscription: string }).subscription)
      : (invoice as unknown as { subscription?: { id?: string } }).subscription?.id;
  if (!subscriptionId) return { handled: false };
  if (invoice.billing_reason !== "subscription_cycle") return { handled: false };

  const order = await getOrderByStripeRef("stripe_subscription_id", subscriptionId);
  if (!order) return { handled: false };

  const amount = invoice.amount_paid ?? 0;
  const result = await recordPlanPayment(order, {
    invoiceId: invoice.id ?? subscriptionId,
    amountCents: amount,
    stripeSecret,
  });
  try {
    const { recordOrderPlanReceipt } = await import("@/lib/kit-invoicing.server");
    await recordOrderPlanReceipt(order.id, amount, invoice.id ?? `${subscriptionId}-${result.paymentsMade}`);
  } catch (err) {
    console.error("Could not record plan receipt", err);
  }
  return { handled: true, ...result };
}

/** Phase 3 hook: failures are logged against the order, nothing is cut off. */
export async function handlePlanInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof (invoice as unknown as { subscription?: unknown }).subscription === "string"
      ? ((invoice as unknown as { subscription: string }).subscription)
      : (invoice as unknown as { subscription?: { id?: string } }).subscription?.id;
  if (!subscriptionId) return { handled: false };
  const order = await getOrderByStripeRef("stripe_subscription_id", subscriptionId);
  if (!order) return { handled: false };
  await recordPlanPaymentFailure(order, invoice.id ?? subscriptionId);
  return { handled: true };
}

/** A refunded deposit charge closes the order out. */
export async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return { handled: false };
  const order = await getOrderByStripeRef("stripe_deposit_payment_intent", paymentIntent);
  if (!order || order.state === "refunded" || order.fulfilled_at) return { handled: false };
  await markRefunded(order, charge.amount_refunded ?? 0, "stripe_refund");
  return { handled: true };
}
