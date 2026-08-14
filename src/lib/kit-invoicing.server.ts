/**
 * Writes a paid Stripe kit checkout into the invoice/receipt ledger.
 *
 * Card orders used to leave no trace in kit_invoices / kit_payments (only EFT
 * orders created records), so the books showed nothing for website card sales.
 * Every paid checkout session now becomes one paid invoice plus one receipt,
 * idempotent on the Stripe checkout session id.
 */
import type Stripe from "stripe";

const PACKAGE_LABELS: Record<string, string> = {
  essentials: "Resonabed Basic",
  pro: "Resonabed Pro",
  platinum: "Resonabed Platinum",
  home: "Resonabed for Home",
};
const LIST_PRICE_CENTS: Record<string, number> = {
  essentials: 119900,
  pro: 139900,
  platinum: 179900,
  home: 149900,
};


const gstOf = (inclusiveCents: number) => Math.round(inclusiveCents / 11);

function meta(session: Stripe.Checkout.Session, key: string): string | null {
  const v = session.metadata?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function addressOf(session: Stripe.Checkout.Session): string | null {
  const addr = session.customer_details?.address;
  if (!addr) return null;
  return (
    [
      addr.line1,
      addr.line2,
      `${addr.city ?? ""} ${addr.state ?? ""} ${addr.postal_code ?? ""}`.trim(),
      addr.country,
    ]
      .filter(Boolean)
      .join("\n") || null
  );
}

export type RecordedKitSale = { invoiceNumber: string; alreadyExisted: boolean };

/** Creates the paid invoice + receipt for a completed Stripe checkout session. */
export async function recordStripeKitSale(
  session: Stripe.Checkout.Session,
): Promise<RecordedKitSale | null> {
  const packageKey = meta(session, "package");
  if (!packageKey) return null;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("kit_invoices")
    .select("invoice_number")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) {
    return { invoiceNumber: existing.invoice_number as string, alreadyExisted: true };
  }

  const plan = meta(session, "plan") === "installments" ? "installments" : "full";
  const discountCents = Number(meta(session, "amount_discounted_cents") ?? 0) || 0;
  const shippingCents = Number(meta(session, "shipping_amount_cents") ?? 0) || 0;
  const shippingRegion = meta(session, "shipping_region");
  const listCents = LIST_PRICE_CENTS[packageKey] ?? 0;
  const collectedCents = session.amount_total ?? 0;

  let shippingGstInclusive = false;
  if (shippingRegion) {
    const { data: rate } = await supabaseAdmin
      .from("shipping_rates")
      .select("gst_inclusive")
      .eq("region", shippingRegion)
      .maybeSingle();
    shippingGstInclusive = !!rate?.gst_inclusive;
  }

  // Kit portion always carries GST; shipping only when the rate is GST-inclusive.
  const kitPortion = Math.max(0, collectedCents - shippingCents);
  const gstCents = gstOf(kitPortion + (shippingGstInclusive ? shippingCents : 0));

  const { data: invNumber, error: numErr } = await supabaseAdmin.rpc("next_kit_invoice_number");
  if (numErr) throw new Error(numErr.message);

  const paidAt = new Date(session.created * 1000).toISOString().slice(0, 10);
  const buyerType = meta(session, "buyer_type") === "business" ? "business" : "personal";

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("kit_invoices")
    .insert({
      invoice_number: invNumber as unknown as string,
      stripe_session_id: session.id,
      customer_name:
        meta(session, "contact_name") ?? session.customer_details?.name ?? "Website customer",
      customer_email:
        meta(session, "contact_email") ??
        session.customer_details?.email ??
        (session.customer_email as string | null) ??
        null,
      customer_phone: meta(session, "contact_phone") ?? session.customer_details?.phone ?? null,
      buyer_type: buyerType,
      business_name: meta(session, "business_name"),
      abn: meta(session, "abn"),
      shipping_address: addressOf(session),
      package_key: packageKey,
      package_label: PACKAGE_LABELS[packageKey] ?? packageKey,
      plan,
      currency: (session.currency ?? "aud").toUpperCase(),
      list_cents: listCents,
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      shipping_region: shippingRegion,
      shipping_gst_inclusive: shippingGstInclusive,
      total_cents: collectedCents,
      gst_cents: gstCents,
      payment_terms: "card",
      due_date: paidAt,
      status: "paid",
      notes: [
        "Website card order, paid through Stripe checkout.",
        packageKey === "home"
          ? "Home package: ships a fitted therapy table plus kit and headphones."
          : null,
        plan === "installments" ? "Deposit collected; monthly instalments follow." : null,
        meta(session, "promo_code") ? `Promo: ${meta(session, "promo_code")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    })
    .select("id, invoice_number")
    .single();
  if (invErr) throw new Error(invErr.message);

  const { data: receiptNumber, error: rcptErr } = await supabaseAdmin.rpc(
    "next_kit_receipt_number",
  );
  if (rcptErr) throw new Error(rcptErr.message);

  const { error: payErr } = await supabaseAdmin.from("kit_payments").insert({
    receipt_number: receiptNumber as unknown as string,
    invoice_id: invoice.id as string,
    amount_cents: collectedCents,
    gst_cents: gstCents,
    method: "card",
    paid_at: paidAt,
    reference: session.payment_intent ? String(session.payment_intent) : session.id,
    notes: "Stripe checkout payment.",
  });
  if (payErr) throw new Error(payErr.message);

  return { invoiceNumber: invoice.invoice_number as string, alreadyExisted: false };
}

/** Walks recent Stripe checkout sessions and records any that are missing. */
export async function backfillStripeKitSales(
  secret: string,
): Promise<{ created: number; skipped: number }> {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret);
  let created = 0;
  let skipped = 0;
  let startingAfter: string | undefined;

  for (let page = 0; page < 5; page++) {
    const res = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of res.data) {
      if (s.status !== "complete") continue;
      const result = await recordStripeKitSale(s);
      if (!result) continue;
      if (result.alreadyExisted) skipped += 1;
      else created += 1;
    }
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
  }
  return { created, skipped };
}

/**
 * Ledger entry for a deposit-first order at the moment it is released.
 *
 * One invoice per order for the full contract value (kit less discount, plus
 * shipping), plus receipts for what has actually been collected so far. Plan
 * monthlies add their own receipts as they clear.
 */
export async function recordOrderInvoice(order: {
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
  shipping_cents: number;
  shipping_gst_inclusive: boolean;
  discount_cents: number;
  list_cents: number;
  contract_cents: number;
  collected_cents: number;
  path: string | null;
  payment_channel: string;
  promo_code: string | null;
}): Promise<RecordedKitSale> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("kit_invoices")
    .select("invoice_number")
    .eq("order_id", order.id)
    .eq("stage", "balance")
    .maybeSingle();
  if (existing) {
    return { invoiceNumber: existing.invoice_number as string, alreadyExisted: true };
  }

  const kitPortion = Math.max(0, order.contract_cents - order.shipping_cents);
  const gstCents = gstOf(kitPortion + (order.shipping_gst_inclusive ? order.shipping_cents : 0));
  const today = new Date().toISOString().slice(0, 10);

  const { data: invNumber, error: numErr } = await supabaseAdmin.rpc("next_kit_invoice_number");
  if (numErr) throw new Error(numErr.message);

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("kit_invoices")
    .insert({
      invoice_number: invNumber as unknown as string,
      order_id: order.id,
      stage: "balance",
      customer_name: order.contact_name ?? order.business_name ?? "Website customer",
      customer_email: order.contact_email,
      customer_phone: order.contact_phone,
      buyer_type: order.buyer_type === "business" ? "business" : "personal",
      business_name: order.business_name,
      abn: order.abn,
      shipping_address: order.shipping_address,
      package_key: order.package_key,
      package_label: order.package_label,
      plan: order.path === "plan" ? "installments" : "full",
      currency: "AUD",
      list_cents: order.list_cents,
      discount_cents: order.discount_cents,
      shipping_cents: order.shipping_cents,
      shipping_region: order.shipping_region,
      shipping_gst_inclusive: order.shipping_gst_inclusive,
      total_cents: order.contract_cents,
      gst_cents: gstCents,
      payment_terms: order.payment_channel === "eft" ? "eft" : "card",
      due_date: today,
      status: order.collected_cents >= order.contract_cents ? "paid" : "partial",
      notes: [
        `Order ${order.order_number}.`,
        "Deposit of $100 plus shipping collected at order, balance cleared before release.",
        order.path === "plan" ? "Balance on a 10 month payment plan." : null,
        order.promo_code ? `Promo: ${order.promo_code}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    })
    .select("id, invoice_number")
    .single();
  if (invErr) throw new Error(invErr.message);

  const { data: receiptNumber, error: rcptErr } = await supabaseAdmin.rpc(
    "next_kit_receipt_number",
  );
  if (rcptErr) throw new Error(rcptErr.message);

  const { error: payErr } = await supabaseAdmin.from("kit_payments").insert({
    receipt_number: receiptNumber as unknown as string,
    invoice_id: invoice.id as string,
    amount_cents: order.collected_cents,
    gst_cents: gstOf(order.collected_cents),
    method: order.payment_channel === "eft" ? "eft" : "card",
    paid_at: today,
    reference: order.order_number,
    notes: "Order deposit, then cleared balance including shipping.",
  });
  if (payErr) throw new Error(payErr.message);

  return { invoiceNumber: invoice.invoice_number as string, alreadyExisted: false };
}

/** Adds a receipt against an order's invoice for a cleared plan monthly. */
export async function recordOrderPlanReceipt(
  orderId: string,
  amountCents: number,
  reference: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: invoice } = await supabaseAdmin
    .from("kit_invoices")
    .select("id")
    .eq("order_id", orderId)
    .eq("stage", "balance")
    .maybeSingle();
  if (!invoice) return;
  const { data: existing } = await supabaseAdmin
    .from("kit_payments")
    .select("id")
    .eq("invoice_id", invoice.id as string)
    .eq("reference", reference)
    .maybeSingle();
  if (existing) return;
  const { data: receiptNumber } = await supabaseAdmin.rpc("next_kit_receipt_number");
  await supabaseAdmin.from("kit_payments").insert({
    receipt_number: receiptNumber as unknown as string,
    invoice_id: invoice.id as string,
    amount_cents: amountCents,
    gst_cents: gstOf(amountCents),
    method: "card",
    paid_at: new Date().toISOString().slice(0, 10),
    reference,
    notes: "Payment plan monthly.",
  });
}
