import Stripe from "stripe";

export type KitSaleRow = {
  id: string;
  created: string;
  status: string;
  paid: boolean;
  customerName: string | null;
  customerEmail: string | null;
  packageKey: "pro" | "premium" | string;
  packageLabel: string;
  plan: "full" | "installments";
  currency: string;
  /** List price of the kit before any discount, in cents (incl. GST). */
  listCents: number;
  /** Promo discount applied to the kit line, in cents. */
  discountCents: number;
  promoCode: string | null;
  promoPercent: number | null;
  shippingRegion: string | null;
  shippingCents: number;
  shippingGstInclusive: boolean;
  /** Amount actually collected on this checkout (deposit only for installments). */
  collectedCents: number;
  /** Total contract value: full price, or deposit + all monthly payments. */
  contractCents: number;
  /** GST component of the collected amount. */
  gstCents: number;
  monthsRemainingPlan: number | null;
};

export type KitSalesSummary = {
  orders: number;
  collectedCents: number;
  contractCents: number;
  discountCents: number;
  shippingCents: number;
  gstCents: number;
  byPackage: { key: string; label: string; count: number; collectedCents: number }[];
};

const PACKAGE_LABELS: Record<string, string> = {
  pro: "Resonabed Pro Kit",
  premium: "Resonabed Premium Kit",
};

const LIST_PRICE_CENTS: Record<string, number> = { pro: 119900, premium: 139900 };

const INSTALLMENTS: Record<string, { deposit: number; monthly: number; months: number }> = {
  pro: { deposit: 39900, monthly: 10000, months: 8 },
  premium: { deposit: 59900, monthly: 10000, months: 8 },
};

/** GST is 1/11 of a GST-inclusive amount (Australia, 10%). */
export function gstOf(inclusiveCents: number) {
  return Math.round(inclusiveCents / 11);
}

export async function loadShippingGstMap(): Promise<Record<string, boolean>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("shipping_rates").select("region, gst_inclusive");
  const map: Record<string, boolean> = { pickup: false };
  for (const r of data ?? []) map[String(r.region)] = !!r.gst_inclusive;
  return map;
}

function toRow(
  s: Stripe.Checkout.Session,
  shippingGstMap: Record<string, boolean>,
): KitSaleRow | null {
  const meta = s.metadata ?? {};
  const packageKey = meta.package;
  if (!packageKey) return null;

  const plan = (meta.plan === "installments" ? "installments" : "full") as "full" | "installments";
  const discountCents = Number(meta.amount_discounted_cents ?? 0) || 0;
  const shippingCents = Number(meta.shipping_amount_cents ?? 0) || 0;
  const shippingRegion = meta.shipping_region ?? null;
  const shippingGstInclusive = shippingRegion ? !!shippingGstMap[shippingRegion] : false;
  const listCents = LIST_PRICE_CENTS[packageKey] ?? 0;

  const collectedCents = s.amount_total ?? 0;

  const inst = INSTALLMENTS[packageKey];
  const contractCents =
    plan === "installments" && inst
      ? inst.deposit + inst.monthly * inst.months + shippingCents
      : listCents - discountCents + shippingCents;

  // Kit portion of the collected amount always carries GST; shipping only when GST-inclusive.
  const kitPortion = Math.max(0, collectedCents - shippingCents);
  const gstBase = kitPortion + (shippingGstInclusive ? shippingCents : 0);

  return {
    id: s.id,
    created: new Date(s.created * 1000).toISOString(),
    status: s.status ?? "unknown",
    paid: s.payment_status === "paid" || s.payment_status === "no_payment_required",
    customerName: s.customer_details?.name ?? null,
    customerEmail: s.customer_details?.email ?? null,
    packageKey,
    packageLabel: PACKAGE_LABELS[packageKey] ?? packageKey,
    plan,
    currency: (s.currency ?? "aud").toUpperCase(),
    listCents,
    discountCents,
    promoCode: meta.promo_code ?? null,
    promoPercent: meta.promo_discount_percent ? Number(meta.promo_discount_percent) : null,
    shippingRegion,
    shippingCents,
    shippingGstInclusive,
    collectedCents,
    contractCents,
    gstCents: gstOf(gstBase),
    monthsRemainingPlan: plan === "installments" && inst ? inst.months : null,
  };
}

export async function fetchKitSales(secret: string): Promise<{
  rows: KitSaleRow[];
  summary: KitSalesSummary;
}> {
  const stripe = new Stripe(secret);
  const rows: KitSaleRow[] = [];
  let startingAfter: string | undefined;

  // Walk up to 500 recent checkout sessions.
  for (let page = 0; page < 5; page++) {
    const res: Stripe.ApiList<Stripe.Checkout.Session> = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const shippingGstMap = page === 0 ? await loadShippingGstMap() : cachedMap!;
    cachedMap = shippingGstMap;
    for (const s of res.data) {
      const row = toRow(s, shippingGstMap);
      if (row && row.status === "complete") rows.push(row);
    }
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
  }

  const summary: KitSalesSummary = {
    orders: rows.length,
    collectedCents: rows.reduce((a, r) => a + r.collectedCents, 0),
    contractCents: rows.reduce((a, r) => a + r.contractCents, 0),
    discountCents: rows.reduce((a, r) => a + r.discountCents, 0),
    shippingCents: rows.reduce((a, r) => a + r.shippingCents, 0),
    gstCents: rows.reduce((a, r) => a + r.gstCents, 0),
    byPackage: Object.values(
      rows.reduce<Record<string, { key: string; label: string; count: number; collectedCents: number }>>(
        (acc, r) => {
          acc[r.packageKey] ??= { key: r.packageKey, label: r.packageLabel, count: 0, collectedCents: 0 };
          acc[r.packageKey].count += 1;
          acc[r.packageKey].collectedCents += r.collectedCents;
          return acc;
        },
        {},
      ),
    ),
  };

  return { rows, summary };
}

let cachedMap: Record<string, boolean> | null = null;
