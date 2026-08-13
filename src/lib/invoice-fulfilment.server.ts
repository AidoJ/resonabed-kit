/**
 * Fulfilment for a manually-paid (EFT/cash/other) kit invoice.
 *
 * Same fork as a card order: business buyers land in the clinic onboarding
 * queue, personal buyers get their home-app access code emailed. Both branches
 * are idempotent on (source, source_ref) = ("eft", invoice_number), so an admin
 * can record a payment and then flip the status by hand without double-issuing.
 */
export type InvoiceRow = {
  invoice_number: string;
  status: string | null;
  buyer_type: string | null;
  business_name: string | null;
  abn: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  package_key: string | null;
  plan: string | null;
  shipping_address: string | null;
  total_cents: number | null;
};

export async function fulfilPaidInvoice(invoice: InvoiceRow): Promise<{
  buyerType: "personal" | "business";
  codeEmail: string | null;
  queuedForOnboarding: boolean;
}> {
  const buyerType = invoice.buyer_type === "business" ? "business" : "personal";
  const email = invoice.customer_email?.trim() || null;

  if (!email) {
    console.error("Paid invoice with no customer email", invoice.invoice_number);
    return { buyerType, codeEmail: null, queuedForOnboarding: false };
  }

  if (buyerType === "business") {
    const { recordOnboardingOrder } = await import("@/lib/onboarding.server");
    const queued = await recordOnboardingOrder({
      source: "eft",
      sourceRef: invoice.invoice_number,
      businessName: invoice.business_name,
      abn: invoice.abn,
      contactName: invoice.customer_name,
      contactEmail: email,
      contactPhone: invoice.customer_phone,
      packageKey: invoice.package_key,
      plan: invoice.plan,
      shippingAddress: invoice.shipping_address,
      amountCents: invoice.total_cents,
      notes: `Invoice ${invoice.invoice_number} paid in full.`,
    });
    return { buyerType, codeEmail: null, queuedForOnboarding: !queued.alreadyExisted };
  }

  const { issueAccessCode } = await import("@/lib/home-access.server");
  const issued = await issueAccessCode({
    buyerEmail: email,
    buyerName: invoice.customer_name,
    buyerPhone: invoice.customer_phone,
    packageKey: invoice.package_key,
    source: "eft",
    sourceRef: invoice.invoice_number,
    buyerType: "personal",
  });
  return { buyerType, codeEmail: issued.buyerEmail, queuedForOnboarding: false };
}
