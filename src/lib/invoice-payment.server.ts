/**
 * Applies a fully paid kit invoice to its website order, following the pure
 * rules in invoice-payment-rules.ts. Server only.
 */
import { actionForPaidInvoice, type InvoicePaymentAction } from "@/lib/invoice-payment-rules";
import type { InvoiceRow } from "@/lib/invoice-fulfilment.server";

export type AppliedInvoicePayment = {
  action: InvoicePaymentAction;
  orderNumber?: string | null;
  orderState?: string | null;
  securedEmailSent?: boolean;
  fulfilled?: boolean;
};

export async function applyPaidInvoice(
  invoice: InvoiceRow & { stage: string | null; order_id: string | null },
  paidCents: number,
): Promise<AppliedInvoicePayment> {
  const action = actionForPaidInvoice(invoice);

  if (action === "legacy_fulfil") {
    const { fulfilPaidInvoice } = await import("@/lib/invoice-fulfilment.server");
    await fulfilPaidInvoice(invoice);
    return { action };
  }
  if (action === "mark_paid_only" || !invoice.order_id) return { action };

  const { getOrderById, markDepositPaid, markBalancePaid, fulfilOrder, logOrderEvent } =
    await import("@/lib/orders.server");
  const order = await getOrderById(invoice.order_id);
  if (!order) return { action: "mark_paid_only" };

  if (action === "secure_order") {
    if (order.state !== "draft") {
      return { action, orderNumber: order.order_number, orderState: order.state };
    }
    const { order: secured, balanceToken } = await markDepositPaid(order, {
      amountCents: paidCents,
    });
    await logOrderEvent(order.id, "eft_deposit_recorded", {
      detail: { invoice: invoice.invoice_number, amount_cents: paidCents, emailed: !!balanceToken },
    });
    return {
      action,
      orderNumber: secured.order_number,
      orderState: secured.state,
      securedEmailSent: !!balanceToken,
    };
  }

  // release_order: only a deposit-secured order moves to paid in full.
  let current = order;
  if (order.state === "deposit_paid") {
    current = await markBalancePaid(order, { amountCents: paidCents });
    await logOrderEvent(order.id, "eft_balance_recorded", {
      detail: { invoice: invoice.invoice_number, amount_cents: paidCents },
    });
  }
  const fulfilment = await fulfilOrder(current.id);
  return {
    action,
    orderNumber: current.order_number,
    orderState: fulfilment.fulfilled ? "fulfilled" : current.state,
    fulfilled: fulfilment.fulfilled,
  };
}
