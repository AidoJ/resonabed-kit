import { describe, expect, it } from "vitest";
import { actionForPaidInvoice, invoiceIsCovered, isAbandonableDraft } from "./invoice-payment-rules";

describe("paid kit invoice rules", () => {
  it("a paid deposit invoice on an order only secures the order", () => {
    expect(actionForPaidInvoice({ stage: "deposit", order_id: "o1" })).toBe("secure_order");
  });

  it("a paid bank-transfer balance invoice releases the order", () => {
    expect(actionForPaidInvoice({ stage: "balance_eft", order_id: "o1" })).toBe("release_order");
  });

  it("a deposit invoice with no order never releases anything", () => {
    expect(actionForPaidInvoice({ stage: "deposit", order_id: null })).toBe("mark_paid_only");
  });

  it("a hand-raised invoice with no order keeps the existing release", () => {
    expect(actionForPaidInvoice({ stage: "legacy", order_id: null })).toBe("legacy_fulfil");
  });

  it("the $100 deposit covers a $100 deposit invoice, $99 does not", () => {
    expect(invoiceIsCovered(10000, [10000])).toBe(true);
    expect(invoiceIsCovered(10000, [9900])).toBe(false);
  });

  it("bank-transfer drafts are never cleaned up as abandoned checkouts", () => {
    expect(isAbandonableDraft("eft")).toBe(false);
    expect(isAbandonableDraft("card")).toBe(true);
  });
});
