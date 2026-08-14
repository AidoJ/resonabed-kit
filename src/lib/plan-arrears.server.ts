/**
 * Phase 3: revenue protection for the 10-month payment plans.
 *
 * Two graduated states, never one blunt rule:
 *
 *   plan_active --(invoice.payment_failed)--> plan_active + arrears_since
 *      day 10, Stripe retries exhausted        -> arrears     (no consequence yet)
 *      day 24 (+7 grace for a clean payer)     -> defaulted   (proportionate)
 *      any payment at any point                -> plan_active (full restore)
 *
 * The consequence scales with what is OUTSTANDING, not with the fact of a miss:
 * a buyer who fails on payment 1 owes most of the kit; one who fails on payment 9
 * owes about one monthly and is left alone.
 *
 * Clinical records, screening history and clearance letters are NEVER withheld,
 * in any tier, for any buyer. That line is absolute.
 */
import { money } from "@/lib/packages";
import {
  getOrderById,
  logOrderEvent,
  updateOrder,
  type KitOrderRow,
} from "@/lib/orders.server";

/* ------------------------------------------------------------------ policy */

/** Stripe Smart Retries run days 3, 5, 7 and 10; we take over after that. */
export const RETRY_WINDOW_DAYS = 10;
/** Time spent in `arrears` before the proportionate default gate is applied. */
export const ARREARS_TO_DEFAULT_DAYS = 14;
/** A payer with no prior failure on this plan gets a week's benefit of the doubt. */
export const CLEAN_PAYER_GRACE_DAYS = 7;
/** Notified wind-down before a clinic is actually suspended. Never an instant cut. */
export const CLINIC_WIND_DOWN_DAYS = 7;

export const TIER_HEAVY_CENTS = 70000; // >= $700 outstanding
export const TIER_MODERATE_CENTS = 25000; // >= $250 outstanding

export type PlanTier = "heavy" | "moderate" | "light";
export type AccessLevel = "full" | "limited" | "suspended";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monthlies still to run. This is the number every decision keys off. */
export function outstandingCents(order: KitOrderRow): number {
  const months = order.plan_months ?? 0;
  const monthly = order.plan_monthly_cents ?? 0;
  return Math.max(0, months - order.payments_made) * monthly;
}

export function tierFor(outstanding: number): PlanTier {
  if (outstanding >= TIER_HEAVY_CENTS) return "heavy";
  if (outstanding >= TIER_MODERATE_CENTS) return "moderate";
  return "light";
}

export const TIER_LABELS: Record<PlanTier, string> = {
  heavy: "Heavy",
  moderate: "Moderate",
  light: "Light, write-off candidate",
};

/**
 * The single source of the access rule. Everything that gates a home account,
 * an access code or an organisation reads this and nothing else.
 */
export function planAccessLevel(order: KitOrderRow, now = new Date()): AccessLevel {
  if (order.state !== "defaulted") return "full";
  const tier = tierFor(outstandingCents(order));
  if (tier === "light") return "full"; // tier C never carries a consequence
  const isClinic = order.buyer_type === "business";

  if (tier === "moderate") return "limited";

  // Heavy. Home locks at once; a clinic gets the notified wind-down first, so
  // their already-booked clients are never stranded.
  if (!isClinic) return "suspended";
  if (!order.wind_down_at) return "limited";
  return new Date(order.wind_down_at).getTime() <= now.getTime() ? "suspended" : "limited";
}

/** Day, from first failure, at which the default gate is evaluated. */
export function defaultDueDay(order: KitOrderRow): number {
  const base = RETRY_WINDOW_DAYS + ARREARS_TO_DEFAULT_DAYS;
  return order.prior_failure_count > 0 ? base : base + CLEAN_PAYER_GRACE_DAYS;
}

export function daysSinceFirstFailure(order: KitOrderRow, now = new Date()): number {
  if (!order.first_failure_at) return 0;
  return (now.getTime() - new Date(order.first_failure_at).getTime()) / DAY_MS;
}

/* ------------------------------------------------------------------ helpers */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function stripeClient() {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) return null;
  const Stripe = (await import("stripe")).default;
  return new Stripe(secret);
}

/* ------------------------------------------------------------ access apply */

/**
 * Writes the access level through to the thing that actually gates the product:
 * the home access code, or the clinic organisation. Always a soft lock, never a
 * delete: everything comes back untouched on payment.
 */
export async function applyAccessLevel(
  order: KitOrderRow,
  level: AccessLevel,
): Promise<{ level: AccessLevel; target: "home" | "clinic" | "none" }> {
  const db = await admin();
  const isClinic = order.buyer_type === "business";
  let target: "home" | "clinic" | "none" = "none";

  if (isClinic) {
    const { data: onboarding } = await db
      .from("kit_onboarding_orders")
      .select("org_id")
      .eq("source", "order")
      .eq("source_ref", order.order_number)
      .maybeSingle();
    const orgId = (onboarding?.org_id as string | null) ?? null;
    if (orgId) {
      target = "clinic";
      const { data: org } = await db
        .from("organisations")
        .select("status, suspended_by_order_id")
        .eq("id", orgId)
        .maybeSingle();

      const patch: Record<string, unknown> = { plan_access_level: level };
      if (level === "suspended") {
        // Only ever suspend an org that is currently running normally, and
        // record that WE did it so restore cannot undo someone else's suspension.
        if (org?.status === "active") {
          patch["status"] = "suspended";
          patch["suspended_by_order_id"] = order.id;
        }
      } else if (org?.suspended_by_order_id === order.id) {
        patch["status"] = "active";
        patch["suspended_by_order_id"] = null;
      }
      await db.from("organisations").update(patch as never).eq("id", orgId);
    }
  } else {
    const { data: code } = await db
      .from("kit_access_codes")
      .select("id")
      .eq("source", "order")
      .eq("source_ref", order.order_number)
      .in("status", ["issued", "redeemed"])
      .maybeSingle();
    if (code) {
      target = "home";
      await db.from("kit_access_codes").update({ access_level: level }).eq("id", code.id);
    }
  }

  await updateOrder(order.id, {
    access_level: level,
    access_applied_at: new Date().toISOString(),
  });
  await logOrderEvent(order.id, level === "full" ? "access_restored" : "access_changed", {
    detail: { level, target, outstanding_cents: outstandingCents(order) },
  });
  return { level, target };
}

/* ----------------------------------------------------------------- failure */

/**
 * `invoice.payment_failed`. Flags the order the same day so the arrears view
 * lights up immediately, and starts dunning. No access change here, ever.
 */
export async function recordPlanPaymentFailure(
  order: KitOrderRow,
  invoiceId: string,
  amountDueCents = 0,
): Promise<{ handled: true; state: string }> {
  const now = new Date();
  const firstFailure = order.first_failure_at ?? now.toISOString();
  const isNewEpisode = !order.arrears_since;

  const updated = await updateOrder(order.id, {
    arrears_since: order.arrears_since ?? now.toISOString(),
    first_failure_at: firstFailure,
    failure_count: order.failure_count + 1,
    // Counted once per episode: was this payer clean before today?
    prior_failure_count: isNewEpisode ? order.failure_count : order.prior_failure_count,
    owed_cents: Math.max(order.owed_cents, 0) + (isNewEpisode ? amountDueCents : 0),
    dunning_stage: 0,
  });

  await logOrderEvent(order.id, "plan_payment_failed", {
    stripeRef: invoiceId,
    detail: {
      failure: updated.failure_count,
      amount_due_cents: amountDueCents,
      outstanding_cents: outstandingCents(updated),
    },
  });

  await sendDunning(updated, 0);
  return { handled: true, state: updated.state };
}

/* ------------------------------------------------------------------ restore */

/**
 * A payment landed on an order that was in arrears or default. Restore is
 * total and immediate: counters cleared, state back to plan_active, access
 * returned everywhere it was taken, subscription unpaused.
 */
export async function restorePlanAfterPayment(order: KitOrderRow): Promise<KitOrderRow> {
  const wasSuspended = order.access_level !== "full";
  const fromState = order.state;

  const restored = await updateOrder(order.id, {
    state: order.state === "plan_completed" ? "plan_completed" : "plan_active",
    arrears_since: null,
    arrears_entered_at: null,
    first_failure_at: null,
    defaulted_at: null,
    wind_down_at: null,
    dunning_stage: 0,
    dunning_paused_until: null,
    owed_cents: 0,
  });

  if (wasSuspended) await applyAccessLevel(restored, "full");

  // The subscription is paused, never cancelled, so resuming is one call and
  // the customer never re-enters card details.
  if (order.stripe_subscription_id) {
    const stripe = await stripeClient();
    if (stripe) {
      try {
        await stripe.subscriptions.update(order.stripe_subscription_id, {
          pause_collection: "",
        } as never);
      } catch (err) {
        console.error("Could not resume plan subscription", order.order_number, err);
      }
    }
  }

  await logOrderEvent(order.id, "plan_restored", {
    fromState,
    toState: restored.state,
    detail: { access_restored: wasSuspended },
  });
  await sendPlanEmail(restored, "plan-restored", {});
  return restored;
}

/* ------------------------------------------------------------- escalations */

async function enterArrears(order: KitOrderRow): Promise<KitOrderRow> {
  const updated = await updateOrder(order.id, {
    state: "arrears",
    arrears_entered_at: new Date().toISOString(),
  });
  await logOrderEvent(order.id, "arrears_entered", {
    fromState: order.state,
    toState: "arrears",
    detail: { outstanding_cents: outstandingCents(order) },
  });
  return updated;
}

/**
 * The proportionate gate. Tier C (< $250 outstanding) is never auto-defaulted:
 * it is flagged as a write-off candidate and left to a human.
 */
export async function evaluateDefault(
  order: KitOrderRow,
): Promise<{ defaulted: boolean; tier: PlanTier; level: AccessLevel }> {
  const outstanding = outstandingCents(order);
  const tier = tierFor(outstanding);

  if (tier === "light") {
    if (order.dunning_stage < 9) {
      await updateOrder(order.id, { dunning_stage: 9 });
      await logOrderEvent(order.id, "write_off_candidate", {
        detail: {
          outstanding_cents: outstanding,
          note: "Below the $250 floor: no default, no access change, human decision only.",
        },
      });
    }
    return { defaulted: false, tier, level: "full" };
  }

  const now = new Date();
  const isClinicHeavy = tier === "heavy" && order.buyer_type === "business";
  const defaulted = await updateOrder(order.id, {
    state: "defaulted",
    defaulted_at: now.toISOString(),
    wind_down_at: isClinicHeavy
      ? new Date(now.getTime() + CLINIC_WIND_DOWN_DAYS * DAY_MS).toISOString()
      : null,
  });
  await logOrderEvent(order.id, "defaulted", {
    fromState: order.state,
    toState: "defaulted",
    detail: {
      tier,
      outstanding_cents: outstanding,
      buyer_type: order.buyer_type,
      wind_down_at: defaulted.wind_down_at,
    },
  });

  const level = planAccessLevel(defaulted, now);
  await applyAccessLevel(defaulted, level);

  // Stop billing attempts while suspended; resume on payment.
  if (defaulted.stripe_subscription_id) {
    const stripe = await stripeClient();
    if (stripe) {
      try {
        await stripe.subscriptions.update(defaulted.stripe_subscription_id, {
          pause_collection: { behavior: "mark_uncollectible" },
        });
      } catch (err) {
        console.error("Could not pause plan subscription", defaulted.order_number, err);
      }
    }
  }

  await sendPlanEmail(defaulted, "plan-access-suspended", {
    tier,
    accessLevel: level,
    windDownAt: defaulted.wind_down_at,
    isClinic: order.buyer_type === "business",
  });
  return { defaulted: true, tier, level };
}

/* ---------------------------------------------------------------- the sweep */

export type ArrearsTickResult = {
  scanned: number;
  dunningSent: number;
  enteredArrears: number;
  defaulted: number;
  writeOffCandidates: number;
  windDownsApplied: number;
  cardExpiryWarnings: number;
};

/**
 * Daily arrears sweep, run from the same cron endpoint as the deposit sweep.
 * Idempotent: every step is guarded by a stamp on the order.
 */
export async function tickPlanArrears(now = new Date()): Promise<ArrearsTickResult> {
  const db = await admin();
  const result: ArrearsTickResult = {
    scanned: 0,
    dunningSent: 0,
    enteredArrears: 0,
    defaulted: 0,
    writeOffCandidates: 0,
    windDownsApplied: 0,
    cardExpiryWarnings: 0,
  };

  const { data } = await db
    .from("kit_orders")
    .select("*")
    .in("state", ["plan_active", "arrears", "defaulted"])
    .limit(500);

  for (const raw of (data ?? []) as unknown as KitOrderRow[]) {
    let order = raw;
    result.scanned += 1;

    if (!order.arrears_since || !order.first_failure_at) {
      result.cardExpiryWarnings += (await warnIfCardExpiring(order)) ? 1 : 0;
      continue;
    }

    // "Customer promised to pay": no emails, no escalation, still visible.
    if (order.dunning_paused_until && new Date(order.dunning_paused_until) > now) continue;

    const days = daysSinceFirstFailure(order, now);

    // Dunning ladder: day 0 on failure, then 5, 10 and 17.
    const stage = days >= 17 ? 3 : days >= RETRY_WINDOW_DAYS ? 2 : days >= 5 ? 1 : 0;
    if (stage > order.dunning_stage && order.dunning_stage < 9) {
      if (await sendDunning(order, stage)) {
        order = await updateOrder(order.id, {
          dunning_stage: stage,
          last_dunning_at: now.toISOString(),
        });
        result.dunningSent += 1;
      }
    }

    // Retries exhausted: arrears. Flagged and chased, but nothing is cut off.
    if (order.state === "plan_active" && days >= RETRY_WINDOW_DAYS) {
      order = await enterArrears(order);
      result.enteredArrears += 1;
    }

    // The proportionate default gate.
    if (order.state === "arrears" && days >= defaultDueDay(order)) {
      const outcome = await evaluateDefault(order);
      if (outcome.defaulted) result.defaulted += 1;
      else result.writeOffCandidates += 1;
      order = (await getOrderById(order.id)) ?? order;
    }

    // Clinic wind-down maturing: the notified date has arrived.
    if (order.state === "defaulted") {
      const level = planAccessLevel(order, now);
      if (level !== order.access_level) {
        await applyAccessLevel(order, level);
        if (level === "suspended") result.windDownsApplied += 1;
      }
    }
  }

  return result;
}

/* ------------------------------------------------- card expiry pre-warning */

/**
 * The cheapest win in the whole phase: warn before the card dies, rather than
 * recovering after it has. One email, once, per card.
 */
export async function warnIfCardExpiring(order: KitOrderRow, now = new Date()): Promise<boolean> {
  if (order.state !== "plan_active" || !order.stripe_customer_id) return false;
  if (!order.contact_email) return false;
  if (order.card_expiry_warned_at) {
    // Re-warn at most once every 60 days, so a replaced-then-expiring card still gets one.
    if (now.getTime() - new Date(order.card_expiry_warned_at).getTime() < 60 * DAY_MS) return false;
  }
  const stripe = await stripeClient();
  if (!stripe || !order.stripe_subscription_id) return false;

  try {
    const sub = await stripe.subscriptions.retrieve(order.stripe_subscription_id, {
      expand: ["default_payment_method"],
    });
    const pm = sub.default_payment_method;
    const card = typeof pm === "object" && pm ? pm.card : null;
    if (!card?.exp_month || !card?.exp_year) return false;

    // Expiry is end of that month; warn when it dies this month or next.
    const expiresAt = new Date(Date.UTC(card.exp_year, card.exp_month, 1));
    const daysLeft = (expiresAt.getTime() - now.getTime()) / DAY_MS;
    if (daysLeft > 45 || daysLeft < 0) return false;

    const sent = await sendPlanEmail(order, "plan-card-expiring", {
      cardBrand: card.brand,
      cardLast4: card.last4,
      cardExpiry: `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}`,
    });
    if (!sent) return false;
    await updateOrder(order.id, { card_expiry_warned_at: now.toISOString() });
    await logOrderEvent(order.id, "card_expiry_warned", {
      detail: { last4: card.last4, expiry: `${card.exp_month}/${card.exp_year}` },
    });
    return true;
  } catch (err) {
    console.error("Card expiry check failed", order.order_number, err);
    return false;
  }
}

/* ------------------------------------------------------------------ emails */

const DUNNING_TEMPLATES = [
  "plan-payment-failed",
  "plan-payment-retry",
  "plan-payment-final-notice",
  "plan-final-warning",
] as const;

export async function sendDunning(order: KitOrderRow, stage: number): Promise<boolean> {
  const template = DUNNING_TEMPLATES[stage];
  if (!template) return false;
  const outstanding = outstandingCents(order);
  return sendPlanEmail(order, template, {
    stage,
    tier: tierFor(outstanding),
    // Tier C is chased gently and never threatened: the tone follows the money.
    gentle: tierFor(outstanding) === "light",
    owedText: money(order.owed_cents || (order.plan_monthly_cents ?? 0)),
    outstandingText: money(outstanding),
  });
}

/**
 * All plan comms carry a tokenised card-update link. The raw token is never
 * stored: it is re-minted on each send, exactly like the balance link.
 */
export async function sendPlanEmail(
  order: KitOrderRow,
  template: string,
  extra: Record<string, unknown>,
): Promise<boolean> {
  if (!order.contact_email) return false;
  try {
    const { mintNewOrderToken, SITE_URL } = await import("@/lib/orders.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const token = await mintNewOrderToken(order.id);
    await sendTemplateEmail(template, order.contact_email, {
      templateData: {
        recipientName: order.contact_name,
        orderNumber: order.order_number,
        packageLabel: order.package_label,
        cardUpdateUrl: `${SITE_URL}/order/card/${token}`,
        paymentsMade: order.payments_made,
        paymentsDue: order.payments_due,
        monthlyText: money(order.plan_monthly_cents ?? 0),
        outstandingText: money(outstandingCents(order)),
        ...extra,
      },
      idempotencyKey: `${template}:${order.order_number}:${order.failure_count}:${
        extra["stage"] ?? "x"
      }`,
    });
    return true;
  } catch (err) {
    console.error("Plan email failed", template, order.order_number, err);
    return false;
  }
}

/* ------------------------------------------------------------ admin actions */

export async function pauseDunning(orderId: string, days = 14) {
  const until = new Date(Date.now() + days * DAY_MS).toISOString();
  await updateOrder(orderId, { dunning_paused_until: until });
  await logOrderEvent(orderId, "dunning_paused", { detail: { until, days } });
  return { until };
}

export async function resumeDunning(orderId: string) {
  await updateOrder(orderId, { dunning_paused_until: null });
  await logOrderEvent(orderId, "dunning_resumed", {});
  return { ok: true };
}

/** Manual restore, for an off-platform (EFT) catch-up payment. */
export async function restoreOrderAccess(orderId: string, note: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  await logOrderEvent(orderId, "manual_restore", { detail: { note } });
  return restorePlanAfterPayment(order);
}

/** Records a payment taken outside Stripe and restores in the same path. */
export async function recordOffPlatformPlanPayment(
  orderId: string,
  amountCents: number,
  reference: string,
) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  const months = order.plan_months ?? 10;
  const paymentsMade = Math.min(months, order.payments_made + 1);
  const updated = await updateOrder(orderId, {
    payments_made: paymentsMade,
    collected_cents: order.collected_cents + amountCents,
  });
  await logOrderEvent(orderId, "plan_payment_offline", {
    detail: { amount_cents: amountCents, reference, payment: paymentsMade, of: months },
  });
  return restorePlanAfterPayment(updated);
}

/** Closes a small remainder out. Deliberate policy, human decision only. */
export async function writeOffOrder(orderId: string, reason: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  const outstanding = outstandingCents(order);
  await updateOrder(orderId, {
    state: "plan_completed",
    write_off_cents: outstanding,
    written_off_at: new Date().toISOString(),
    plan_completed_at: order.plan_completed_at ?? new Date().toISOString(),
    arrears_since: null,
    first_failure_at: null,
    dunning_stage: 0,
    owed_cents: 0,
  });
  if (order.access_level !== "full") {
    await applyAccessLevel(order, "full");
  }
  if (order.stripe_subscription_id) {
    const stripe = await stripeClient();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(order.stripe_subscription_id);
      } catch (err) {
        console.error("Could not cancel written-off subscription", err);
      }
    }
  }
  await logOrderEvent(orderId, "written_off", {
    fromState: order.state,
    toState: "plan_completed",
    detail: { write_off_cents: outstanding, reason },
  });
  return { writtenOffCents: outstanding };
}
