/**
 * Server-only helpers for "pay by invoice / EFT" website kit orders.
 * Creates a kit invoice record and returns the bank details the customer
 * needs in order to pay by bank transfer.
 */

export const KIT_PACKAGES = {
  essentials: { label: "Resonabed Basic", listCents: 119900 },
  pro: { label: "Resonabed Pro", listCents: 139900 },
  platinum: { label: "Resonabed Platinum", listCents: 179900 },
  home: { label: "Resonabed for Home", listCents: 149900 },
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

/**
 * Deposit-first EFT path: raises a tax invoice for the $100 order deposit plus
 * shipping only. The balance invoice is raised once the deposit clears, and no
 * kit is released until that balance is paid.
 */
export async function createEftDepositInvoice(
  order: {
    id: string;
    order_number: string;
    package_key: string;
    package_label: string;
    buyer_type: string;
    business_name: string | null;
    abn: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    shipping_address: string | null;
    shipping_region: string | null;
    shipping_label: string | null;
    shipping_cents: number;
    shipping_gst_inclusive: boolean;
    deposit_cents: number;
    balance_cents: number;
    discount_cents: number;
    list_cents: number;
    promo_code: string | null;
  },
  balanceToken: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const totalCents = order.deposit_cents + order.shipping_cents;
  const taxable = totalCents - (order.shipping_gst_inclusive ? 0 : order.shipping_cents);
  const gstCents = gstOf(Math.max(0, taxable));

  const { data: numberRow, error: numErr } = await supabaseAdmin.rpc("next_kit_invoice_number");
  if (numErr) throw new Error(numErr.message);

  const due = new Date();
  due.setDate(due.getDate() + 7);

  const { data: row, error } = await supabaseAdmin
    .from("kit_invoices")
    .insert({
      invoice_number: numberRow as unknown as string,
      order_id: order.id,
      stage: "deposit",
      customer_name: order.contact_name ?? "Website customer",
      customer_email: order.contact_email,
      customer_phone: order.contact_phone,
      buyer_type: order.buyer_type === "business" ? "business" : "personal",
      business_name: order.business_name,
      abn: order.abn,
      shipping_address: order.shipping_address,
      package_key: order.package_key,
      package_label: order.package_label,
      plan: "full",
      list_cents: order.list_cents,
      discount_cents: 0,
      shipping_cents: order.shipping_cents,
      shipping_region: order.shipping_region,
      shipping_gst_inclusive: order.shipping_gst_inclusive,
      total_cents: totalCents,
      gst_cents: gstCents,
      payment_terms: "eft",
      due_date: due.toISOString().slice(0, 10),
      status: "sent",
      notes: [
        `Order ${order.order_number}, order deposit and shipping.`,
        "Nothing ships on the deposit. A balance invoice follows once this clears.",
        `Shipping: ${order.shipping_label ?? "as quoted"}.`,
        order.promo_code ? `Promo ${order.promo_code} applies to the balance.` : null,
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

  let bank = {
    businessName: "ResonaBed",
    bankName: "",
    bsb: "",
    accountNumber: "",
    accountName: "",
    email: "",
  };
  if (settings?.value) {
    try {
      bank = { ...bank, ...(JSON.parse(settings.value as string) as Record<string, string>) };
    } catch {
      /* keep defaults */
    }
  }

  return {
    invoiceNumber: row.invoice_number as string,
    orderNumber: order.order_number,
    totalCents: row.total_cents as number,
    gstCents: row.gst_cents as number,
    dueDate: row.due_date as string | null,
    depositCents: order.deposit_cents,
    balanceCents: order.balance_cents,
    discountCents: order.discount_cents,
    shippingCents: order.shipping_cents,
    shippingLabel: order.shipping_label ?? "",
    balanceToken,
    bank,
  };
}

/** Balance invoice for an EFT order whose deposit has cleared. */
export async function createEftBalanceInvoice(order: {
  id: string;
  order_number: string;
  package_key: string;
  package_label: string;
  buyer_type: string;
  business_name: string | null;
  abn: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  shipping_address: string | null;
  shipping_region: string | null;
  shipping_gst_inclusive: boolean;
  balance_cents: number;
  discount_cents: number;
  list_cents: number;
  promo_code: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("kit_invoices")
    .select("invoice_number, total_cents, gst_cents, due_date")
    .eq("order_id", order.id)
    .eq("stage", "balance_eft")
    .maybeSingle();

  let row = existing;
  if (!row) {
    const { data: numberRow, error: numErr } = await supabaseAdmin.rpc("next_kit_invoice_number");
    if (numErr) throw new Error(numErr.message);
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const { data: inserted, error } = await supabaseAdmin
      .from("kit_invoices")
      .insert({
        invoice_number: numberRow as unknown as string,
        order_id: order.id,
        stage: "balance_eft",
        customer_name: order.contact_name ?? "Website customer",
        customer_email: order.contact_email,
        customer_phone: order.contact_phone,
        buyer_type: order.buyer_type === "business" ? "business" : "personal",
        business_name: order.business_name,
        abn: order.abn,
        shipping_address: order.shipping_address,
        package_key: order.package_key,
        package_label: order.package_label,
        plan: "full",
        list_cents: order.list_cents,
        discount_cents: order.discount_cents,
        shipping_cents: 0,
        shipping_region: order.shipping_region,
        shipping_gst_inclusive: order.shipping_gst_inclusive,
        total_cents: order.balance_cents,
        gst_cents: gstOf(order.balance_cents),
        payment_terms: "eft",
        due_date: due.toISOString().slice(0, 10),
        status: "sent",
        notes: [
          `Order ${order.order_number}, balance.`,
          "Deposit and shipping already paid. Kit is released once this invoice clears.",
          order.promo_code ? `Promo: ${order.promo_code}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      })
      .select("invoice_number, total_cents, gst_cents, due_date")
      .single();
    if (error) throw new Error(error.message);
    row = inserted;
  }

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "kit_billing_profile")
    .maybeSingle();
  let bank = {
    businessName: "ResonaBed",
    bankName: "",
    bsb: "",
    accountNumber: "",
    accountName: "",
    email: "",
  };
  if (settings?.value) {
    try {
      bank = { ...bank, ...(JSON.parse(settings.value as string) as Record<string, string>) };
    } catch {
      /* keep defaults */
    }
  }

  return {
    invoiceNumber: row!.invoice_number as string,
    totalCents: row!.total_cents as number,
    gstCents: row!.gst_cents as number,
    dueDate: row!.due_date as string | null,
    bank,
  };
}
