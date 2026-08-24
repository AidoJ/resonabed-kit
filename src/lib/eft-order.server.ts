/**
 * Server-only helpers for "pay by invoice / EFT" website kit orders.
 * Deposit-first: the deposit invoice is raised from the order row (which
 * carries its own frozen prices), and the balance invoice follows once the
 * deposit clears.
 */

const gstOf = (inclusiveCents: number) => Math.round(inclusiveCents / 11);

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

  // Deposit stage is a clean $100. Shipping is quoted and locked on the order,
  // then invoiced with the balance.
  const totalCents = order.deposit_cents;
  const gstCents = gstOf(Math.max(0, totalCents));

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
      shipping_cents: 0,
      shipping_region: order.shipping_region,
      shipping_gst_inclusive: order.shipping_gst_inclusive,
      total_cents: totalCents,
      gst_cents: gstCents,
      payment_terms: "eft",
      due_date: due.toISOString().slice(0, 10),
      status: "sent",
      notes: [
        `Order ${order.order_number}, order deposit.`,
        "Nothing ships on the deposit. A balance invoice follows once this clears.",
        `Shipping quoted and locked: ${order.shipping_label ?? "as quoted"}, charged with the balance.`,
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
  shipping_label: string | null;
  shipping_cents: number;
  shipping_charged_at: string | null;
  shipping_gst_inclusive: boolean;
  balance_cents: number;
  discount_cents: number;
  list_cents: number;
  promo_code: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Shipping was quoted and locked at deposit time and is collected here, once.
  const shippingDue = order.shipping_charged_at ? 0 : order.shipping_cents;
  const invoiceTotal = order.balance_cents + shippingDue;
  const taxable = invoiceTotal - (order.shipping_gst_inclusive ? 0 : shippingDue);

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
        shipping_cents: shippingDue,
        shipping_region: order.shipping_region,
        shipping_gst_inclusive: order.shipping_gst_inclusive,
        total_cents: invoiceTotal,
        gst_cents: gstOf(Math.max(0, taxable)),
        payment_terms: "eft",
        due_date: due.toISOString().slice(0, 10),
        status: "sent",
        notes: [
          `Order ${order.order_number}, balance.`,
          shippingDue > 0
            ? `Includes shipping of $${(shippingDue / 100).toFixed(2)} (${order.shipping_label ?? "as quoted"}), quoted with your deposit.`
            : "Pickup, no shipping charge.",
          "Deposit already paid. Kit is released once this invoice clears.",
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
