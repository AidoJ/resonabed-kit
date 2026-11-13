/**
 * Pure rules for what a fully paid kit invoice is allowed to do. No I/O, so the
 * deposit-vs-balance decision can be tested on its own.
 *
 * The one rule that matters: a paid deposit invoice only secures the order. It
 * never releases product (no Home access code, no clinic setup queue). Only a
 * paid balance invoice releases the order.
 */

export type InvoicePaymentAction =
  /** Deposit invoice on a website order: mark the order "deposit received" only. */
  | "secure_order"
  /** Balance invoice on a website order: mark it paid in full and release it. */
  | "release_order"
  /** Record the invoice as paid and do nothing else. */
  | "mark_paid_only"
  /** Hand-raised invoice with no website order: existing release on full payment. */
  | "legacy_fulfil";

export type InvoiceForPayment = { stage: string | null; order_id: string | null };

const BALANCE_STAGES = new Set(["balance_eft", "balance"]);
const ORDER_STAGES = new Set(["deposit", "balance_eft", "balance"]);

export function actionForPaidInvoice(invoice: InvoiceForPayment): InvoicePaymentAction {
  const stage = invoice.stage ?? "";
  if (invoice.order_id) {
    if (stage === "deposit") return "secure_order";
    if (BALANCE_STAGES.has(stage)) return "release_order";
    return "mark_paid_only";
  }
  // An order-stage invoice whose order is gone must never release product.
  if (ORDER_STAGES.has(stage)) return "mark_paid_only";
  return "legacy_fulfil";
}

/** True once the recorded payments cover the invoice total. */
export function invoiceIsCovered(totalCents: number, paymentsCents: number[]): boolean {
  const sum = paymentsCents.reduce((a, b) => a + b, 0);
  return sum >= totalCents;
}

/**
 * Abandoned-checkout cleanup only removes card drafts. A bank-transfer order
 * stays a draft until the deposit is recorded by hand, which can take days.
 */
export function isAbandonableDraft(paymentChannel: string | null | undefined): boolean {
  return paymentChannel !== "eft";
}
