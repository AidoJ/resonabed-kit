/**
 * Pure builder for the bank-transfer (EFT) tax invoice email. No I/O, so the
 * amounts, lines and subject can be tested on their own. The server code in
 * eft-order.server.ts loads the rows and hands them in here.
 */

/** Every EFT invoice email is also copied here. */
export const EFT_INVOICE_ADMIN_COPY = "info@resonabed.com";

export const eftInvoiceSubject = (invoiceNumber: string) =>
  `Resonabed tax invoice ${invoiceNumber}: bank transfer details`;

export type EftInvoiceStage = "deposit" | "balance";

export type EftInvoiceLine = { label: string; note?: string; amountCents: number };

export type EftInvoiceEmailInput = {
  stage: EftInvoiceStage;
  invoice: {
    invoiceNumber: string;
    totalCents: number;
    gstCents: number;
    dueDate: string | null;
    issuedAt: string;
  };
  order: {
    orderNumber: string;
    packageLabel: string;
    buyerType: string;
    businessName: string | null;
    abn: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    pickup: boolean;
    shippingAddress: string | null;
    shippingLabel: string | null;
    shippingCents: number;
    shippingGstInclusive: boolean;
    shippingChargedAt: string | null;
    listCents: number;
    depositCents: number;
    balanceCents: number;
    discountCents: number;
    promoCode: string | null;
    expiresAt: string | null;
  };
  seller: {
    businessName: string;
    abn: string;
    address: string;
    email: string;
    accountName: string;
    bankName: string;
    bsb: string;
    accountNumber: string;
  };
  orderUrl: string;
};

export type EftInvoiceEmailData = {
  stage: EftInvoiceStage;
  recipientName: string | null;
  invoiceNumber: string;
  orderNumber: string;
  packageLabel: string;
  issueDate: string;
  dueDate: string | null;
  seller: { name: string; abn: string; address: string; email: string };
  buyer: {
    name: string;
    attention: string | null;
    abn: string | null;
    email: string | null;
    phone: string | null;
    shipTo: string | null;
  };
  lines: EftInvoiceLine[];
  subtotalExGstCents: number;
  gstCents: number;
  totalCents: number;
  amountDueCents: number;
  reference: string;
  bank: { accountName: string; bankName: string; bsb: string; accountNumber: string };
  /** Shipping quoted with the order and added to the balance (0 for pickup). */
  shippingCents: number;
  shippingLabel: string | null;
  pickup: boolean;
  /** Deposit stage only: what the balance invoice will be for, before shipping. */
  balanceCents: number;
  depositCents: number;
  expiresAt: string | null;
  orderUrl: string;
  /** Set only on the copy sent to the admin inbox. */
  copyOfEmailTo?: string | null;
};

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

export function buildEftInvoiceEmail(input: EftInvoiceEmailInput): EftInvoiceEmailData {
  const { stage, invoice, order, seller } = input;
  const lines: EftInvoiceLine[] = [];
  // Shipping is quoted with the order and charged once, on the balance.
  const shippingOnBalance = order.shippingChargedAt ? 0 : order.shippingCents;

  if (stage === "deposit") {
    lines.push({
      label: `${order.packageLabel}, order deposit`,
      note: `Deposit towards the ${aud(order.listCents)} package price. The balance of ${aud(
        order.balanceCents,
      )}${shippingOnBalance > 0 ? ` plus ${aud(shippingOnBalance)} shipping` : ""} is invoiced separately.`,
      amountCents: invoice.totalCents,
    });
  } else {
    const parts = [`Package price ${aud(order.listCents)}`];
    if (order.discountCents > 0) {
      parts.push(
        `less ${aud(order.discountCents)} discount${order.promoCode ? ` (promo ${order.promoCode})` : ""}`,
      );
    }
    parts.push(`less ${aud(order.depositCents)} deposit paid`);
    lines.push({
      label: `${order.packageLabel}, balance`,
      note: parts.join(", "),
      amountCents: order.balanceCents,
    });
    const shippingOnThisInvoice = Math.max(0, invoice.totalCents - order.balanceCents);
    if (shippingOnThisInvoice > 0) {
      lines.push({
        label: "Shipping",
        note: `${order.shippingLabel ?? "As quoted"}${order.shippingGstInclusive ? ", GST inclusive" : ", GST-free export"}`,
        amountCents: shippingOnThisInvoice,
      });
    }
  }

  const business = order.buyerType === "business" ? order.businessName : null;
  return {
    stage,
    recipientName: order.contactName,
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: order.orderNumber,
    packageLabel: order.packageLabel,
    issueDate: invoice.issuedAt,
    dueDate: invoice.dueDate,
    seller: {
      name: seller.businessName || "Resonabed",
      abn: seller.abn,
      address: seller.address,
      email: seller.email,
    },
    buyer: {
      name: business || order.contactName || order.contactEmail || "Customer",
      attention: business && order.contactName ? order.contactName : null,
      abn: order.abn,
      email: order.contactEmail,
      phone: order.contactPhone,
      shipTo: order.pickup ? null : order.shippingAddress,
    },
    lines,
    subtotalExGstCents: Math.max(0, invoice.totalCents - invoice.gstCents),
    gstCents: invoice.gstCents,
    totalCents: invoice.totalCents,
    // The whole invoice is due now: the deposit, or the balance plus shipping.
    amountDueCents: invoice.totalCents,
    reference: invoice.invoiceNumber,
    bank: {
      accountName: seller.accountName,
      bankName: seller.bankName,
      bsb: seller.bsb,
      accountNumber: seller.accountNumber,
    },
    shippingCents: shippingOnBalance,
    shippingLabel: order.shippingLabel,
    pickup: order.pickup,
    balanceCents: order.balanceCents,
    depositCents: order.depositCents,
    expiresAt: order.expiresAt,
    orderUrl: input.orderUrl,
  };
}
