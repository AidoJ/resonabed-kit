import { describe, expect, it } from "vitest";
import {
  buildEftInvoiceEmail,
  eftInvoiceSubject,
  EFT_INVOICE_ADMIN_COPY,
  type EftInvoiceEmailInput,
} from "./eft-invoice-email";

const base: EftInvoiceEmailInput = {
  stage: "deposit",
  invoice: { invoiceNumber: "INV-01008", totalCents: 10000, gstCents: 909, dueDate: "2026-11-19", issuedAt: "2026-11-12T06:00:00Z" },
  order: {
    orderNumber: "BA00004",
    packageLabel: "Resonabed Basic",
    buyerType: "personal",
    businessName: null,
    abn: null,
    contactName: "Sam",
    contactEmail: "sam@example.com",
    contactPhone: null,
    pickup: false,
    shippingAddress: "1 Example St",
    shippingLabel: "Standard",
    shippingCents: 9900,
    shippingGstInclusive: true,
    shippingChargedAt: null,
    listCents: 139900,
    depositCents: 10000,
    balanceCents: 129900,
    discountCents: 0,
    promoCode: null,
    expiresAt: null,
  },
  seller: { businessName: "Seller", abn: "1", address: "", email: "", accountName: "A", bankName: "B", bsb: "000-000", accountNumber: "1" },
  orderUrl: "https://resonabed.com/order/balance/x",
};

describe("EFT invoice email", () => {
  it("uses the owner's subject line", () => {
    expect(eftInvoiceSubject("INV-01008")).toBe("Resonabed tax invoice INV-01008: bank transfer details");
  });

  it("copies every EFT invoice email to info@resonabed.com", () => {
    expect(EFT_INVOICE_ADMIN_COPY).toBe("info@resonabed.com");
  });

  it("deposit invoice: amount due now is the $100 deposit, shipping is left for the balance", () => {
    const d = buildEftInvoiceEmail(base);
    expect(d.amountDueCents).toBe(10000);
    expect(d.shippingCents).toBe(9900);
    expect(d.reference).toBe("INV-01008");
  });

  it("balance invoice: amount due now is the balance plus the quoted shipping", () => {
    const d = buildEftInvoiceEmail({
      ...base,
      stage: "balance",
      invoice: { ...base.invoice, invoiceNumber: "INV-01009", totalCents: 129900 + 9900, gstCents: 12718 },
    });
    expect(d.amountDueCents).toBe(139800);
    expect(d.lines.map((l) => l.amountCents)).toEqual([129900, 9900]);
    expect(d.reference).toBe("INV-01009");
  });
});
