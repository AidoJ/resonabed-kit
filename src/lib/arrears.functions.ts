import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Payment-plan arrears: one public function (the tokenised card-update link)
 * and the super-admin arrears desk.
 */

/* ------------------------------------------------------- public, tokenised */

/**
 * Opens a Stripe billing-portal session limited to updating the card. The
 * token is a 24 byte random value, stored only as a SHA-256 hash, exactly like
 * the balance link, so the URL is not guessable and not enumerable.
 */
export const startCardUpdate = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(20).max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { getOrderByToken, SITE_URL } = await import("@/lib/orders.server");
    const order = await getOrderByToken(data.token);
    if (!order || !order.stripe_customer_id) {
      throw new Error("That link is no longer valid. Please use the newest email we sent you.");
    }
    const secret = process.env["STRIPE_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured");
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const session = await stripe.billingPortal.sessions.create({
      customer: order.stripe_customer_id,
      return_url: `${SITE_URL}/order/card/${data.token}?done=1`,
    });
    return {
      url: session.url,
      orderNumber: order.order_number,
      packageLabel: order.package_label,
    };
  });

/* ------------------------------------------------------------ admin desk */

export type ArrearsRow = {
  id: string;
  orderNumber: string;
  packageLabel: string;
  buyerType: "personal" | "business";
  buyerName: string | null;
  buyerEmail: string | null;
  state: string;
  bucket: "action" | "chasing" | "soft" | "healthy";
  tier: "heavy" | "moderate" | "light";
  paymentsMade: number;
  paymentsDue: number;
  monthlyCents: number;
  collectedCents: number;
  contractCents: number;
  outstandingCents: number;
  /** What they owe right now: the failed instalment(s), not the whole contract. */
  owedTodayCents: number;
  arrearsSince: string | null;
  daysInArrears: number | null;
  defaultDueInDays: number | null;
  defaultedAt: string | null;
  windDownAt: string | null;
  accessLevel: "full" | "limited" | "suspended";
  dunningStage: number;
  lastDunningAt: string | null;
  dunningPausedUntil: string | null;
  writeOffCents: number | null;
};

export type ArrearsSummary = {
  totalOutstandingCents: number;
  atRiskCents: number;
  recoveredThisMonth: number;
  writtenOffThisYearCents: number;
  counts: { action: number; chasing: number; soft: number; healthy: number };
};

async function assertSuper(context: { supabase: any; userId: string }) {
  const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (!isSuper) throw new Error("Forbidden");
}

export const listPlanArrears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: ArrearsRow[]; summary: ArrearsSummary }> => {
    await assertSuper(context as never);
    const { fetchPlanArrears } = await import("@/lib/arrears.server");
    return fetchPlanArrears();
  });

const orderId = z.object({ orderId: z.string().uuid() });

export const resendPlanDunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.extend({ stage: z.number().int().min(0).max(3) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { getOrderById } = await import("@/lib/orders.server");
    const { sendDunning } = await import("@/lib/plan-arrears.server");
    const order = await getOrderById(data.orderId);
    if (!order) throw new Error("Order not found");
    return { sent: await sendDunning(order, data.stage) };
  });

export const sendPlanCardLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { getOrderById } = await import("@/lib/orders.server");
    const { sendPlanEmail } = await import("@/lib/plan-arrears.server");
    const order = await getOrderById(data.orderId);
    if (!order) throw new Error("Order not found");
    return { sent: await sendPlanEmail(order, "plan-card-expiring", {}) };
  });

export const pausePlanDunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    orderId.extend({ days: z.number().int().min(1).max(60).default(14) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { pauseDunning } = await import("@/lib/plan-arrears.server");
    return pauseDunning(data.orderId, data.days);
  });

export const resumePlanDunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { resumeDunning } = await import("@/lib/plan-arrears.server");
    return resumeDunning(data.orderId);
  });

export const restorePlanAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.extend({ note: z.string().max(400).default("") }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { restoreOrderAccess } = await import("@/lib/plan-arrears.server");
    const order = await restoreOrderAccess(data.orderId, data.note || "admin restore");
    return { state: order.state, accessLevel: order.access_level };
  });

export const recordPlanPaymentOffline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    orderId
      .extend({
        amountCents: z.number().int().min(1).max(1_000_000),
        reference: z.string().trim().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { recordOffPlatformPlanPayment } = await import("@/lib/plan-arrears.server");
    const order = await recordOffPlatformPlanPayment(
      data.orderId,
      data.amountCents,
      data.reference,
    );
    return { paymentsMade: order.payments_made, state: order.state };
  });

export const closePlanAsSettled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.extend({ reason: z.string().trim().max(400) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { writeOffOrder } = await import("@/lib/plan-arrears.server");
    return writeOffOrder(data.orderId, data.reason || "closed as settled");
  });

export const getPlanOrderEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orderId.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuper(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("kit_order_events")
      .select("id, event_type, from_state, to_state, stripe_ref, detail, created_at")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });
