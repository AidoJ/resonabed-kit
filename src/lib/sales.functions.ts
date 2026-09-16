import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listKitSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Forbidden");

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");

    const { fetchKitSales } = await import("@/lib/sales.server");
    return await fetchKitSales(secret);
  });

/** Writes any paid Stripe checkout that has no invoice yet into the ledger. */
export const syncKitSalesToLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Forbidden");

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured");

    const { backfillStripeKitSales } = await import("@/lib/kit-invoicing.server");
    return await backfillStripeKitSales(secret);
  });

/**
 * Emails the customer a fresh private balance link (pay in full or start the
 * plan). A new token is minted, so any earlier link stops working.
 */
export const resendOrderBalanceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: unknown; data: { orderId: string } }) => {
    const ctx = context as { supabase: { rpc: Function }; userId: string };
    const { data: isSuper } = await ctx.supabase.rpc("is_super_admin", {
      _user_id: ctx.userId,
    });
    if (!isSuper) throw new Error("Forbidden");

    const { getOrderById, logOrderEvent, sendDepositReceivedEmail } = await import(
      "@/lib/orders.server"
    );
    const order = await getOrderById(data.orderId);
    if (!order) throw new Error("Order not found");
    if (order.state !== "deposit_paid") {
      throw new Error("The balance has already been settled for this order.");
    }

    const sent = await sendDepositReceivedEmail(order);
    if (!sent) throw new Error(`Could not email ${order.contact_email ?? "the customer"}.`);
    await logOrderEvent(order.id, "balance_link_resent", {
      by: ctx.userId,
      detail: { email: order.contact_email },
    });
    return { ok: true, email: order.contact_email };
  });

