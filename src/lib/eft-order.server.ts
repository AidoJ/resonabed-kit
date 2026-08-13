/**
 * Server-only helpers for "pay by invoice / EFT" website kit orders.
 * Creates a kit invoice record and returns the bank details the customer
 * needs in order to pay by bank transfer.
 */

export const KIT_PACKAGES = {
  pro: { label: "Resonabed Pro Kit", listCents: 119900 },
  premium: { label: "Resonabed Premium Kit", listCents: 139900 },
  home: { label: "Resonabed for Home", listCents: 159900 },
} as const;

export type KitPackageKey = keyof typeof KIT_PACKAGES;

export type EftOrderInput = {
  packageKey: KitPackageKey;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  promoCode?: string | null;
  shipping: { region: string; label: string; amount: number; gstInclusive: boolean };
  /** 'personal' | 'business'. Decides the post-payment path when paid. */
  buyerType?: string | null;
  businessName?: string | null;
  abn?: string | null;
};

const gstOf = (inclusiveCents: number) => Math.round(inclusiveCents / 11);

export async function createEftKitInvoice(input: EftOrderInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pkg = KIT_PACKAGES[input.packageKey];

  let discountCents = 0;
  let promoLabel: string | null = null;
  const code = input.promoCode?.trim().toUpperCase() || null;
  if (code) {
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("id, code, active, discount_percent, max_redemptions, times_redeemed")
      .eq("code", code)
      .maybeSingle();
    if (!promo || !promo.active) throw new Error("That promo code is not active");
    if (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions) {
      throw new Error("That promo code has reached its redemption limit");
    }
    discountCents = Math.floor((pkg.listCents * promo.discount_percent) / 100);
    promoLabel = `${promo.code} (${promo.discount_percent}% off)`;
  }

  const shippingCents = input.shipping.amount;
  const totalCents = Math.max(0, pkg.listCents - discountCents + shippingCents);
  const taxable = totalCents - (input.shipping.gstInclusive ? 0 : shippingCents);
  const gstCents = gstOf(Math.max(0, taxable));

  const { data: numberRow, error: numErr } = await supabaseAdmin.rpc("next_kit_invoice_number");
  if (numErr) throw new Error(numErr.message);

  const due = new Date();
  due.setDate(due.getDate() + 7);

  const { data: row, error } = await supabaseAdmin
    .from("kit_invoices")
    .insert({
      invoice_number: numberRow as unknown as string,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone || null,
      buyer_type: input.buyerType || "personal",
      business_name: input.businessName || null,
      abn: input.abn || null,
      shipping_address: input.shippingAddress || null,
      package_key: input.packageKey,
      package_label: pkg.label,
      plan: "full",
      list_cents: pkg.listCents,
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      shipping_region: input.shipping.region,
      shipping_gst_inclusive: input.shipping.gstInclusive,
      total_cents: totalCents,
      gst_cents: gstCents,
      payment_terms: "eft",
      due_date: due.toISOString().slice(0, 10),
      status: "sent",
      notes: [
        "Website order, pay by EFT bank transfer.",
        input.packageKey === "home"
          ? "Home package: ships a fitted therapy table plus kit and headphones."
          : null,
        `Shipping: ${input.shipping.label}.`,
        promoLabel ? `Promo: ${promoLabel}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    })
    .select("invoice_number, total_cents, gst_cents, due_date")
    .single();
  if (error) throw new Error(error.message);

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "kit_billing_profile")
    .maybeSingle();

  let bank = { businessName: "ResonaBed", bankName: "", bsb: "", accountNumber: "", accountName: "", email: "" };
  if (settings?.value) {
    try {
      bank = { ...bank, ...(JSON.parse(settings.value as string) as Record<string, string>) };
    } catch {
      /* keep defaults */
    }
  }

  return {
    invoiceNumber: row.invoice_number as string,
    totalCents: row.total_cents as number,
    gstCents: row.gst_cents as number,
    dueDate: row.due_date as string | null,
    discountCents,
    shippingCents,
    shippingLabel: input.shipping.label,
    bank,
  };
}
