
export type KitSaleRow = {
  id: string;
  created: string;
  status: string;
  paid: boolean;
  customerName: string | null;
  customerEmail: string | null;
  packageKey: "essentials" | "pro" | "platinum" | "home" | string;
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
  /** Order state machine value, e.g. deposit_paid, balance_paid, plan_active, fulfilled. */
  state: string;
  fulfilled: boolean;
  /** What the buyer told us at checkout. */
  buyerType: "personal" | "business";
  /** Refined once a business order is provisioned into an organisation. */
  buyerCategory: BuyerCategory;
  businessName: string | null;
};

export type BuyerCategory =
  | "clinic"
  | "home_business"
  | "business_pending"
  | "private"
  | "legacy_unclassified";

export const BUYER_CATEGORY_LABELS: Record<BuyerCategory, string> = {
  clinic: "Clinic, retail premises",
  home_business: "Home-based business",
  business_pending: "Business, awaiting setup",
  private: "Private user",
  legacy_unclassified: "Unclassified legacy purchase",
};

export type KitSalesSummary = {
  orders: number;
  collectedCents: number;
  contractCents: number;
  discountCents: number;
  shippingCents: number;
  gstCents: number;
  byPackage: { key: string; label: string; count: number; collectedCents: number }[];
  byBuyer: { key: BuyerCategory; label: string; count: number; collectedCents: number }[];
};

export type BuyerLookup = Record<string, { category: BuyerCategory; businessName: string | null }>;

/**
 * Business orders land in the onboarding queue keyed on the Stripe session id;
 * once provisioned the linked organisation tells us retail vs home-based.
 */
export async function loadBuyerLookup(): Promise<BuyerLookup> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orders } = await supabaseAdmin
    .from("kit_onboarding_orders")
    .select("source_ref, business_name, org_id");
  const orgIds = [...new Set((orders ?? []).map((o) => o.org_id).filter(Boolean))] as string[];
  const clinicTypes = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await supabaseAdmin
      .from("organisations")
      .select("id, clinic_type")
      .in("id", orgIds);
    for (const o of orgs ?? []) clinicTypes.set(o.id as string, String(o.clinic_type ?? ""));
  }
  const lookup: BuyerLookup = {};
  for (const o of orders ?? []) {
    const ref = o.source_ref as string | null;
    if (!ref) continue;
    const type = o.org_id ? clinicTypes.get(o.org_id as string) : null;
    lookup[ref] = {
      category: type === "home" ? "home_business" : type === "retail" ? "clinic" : "business_pending",
      businessName: (o.business_name as string | null) ?? null,
    };
  }
  return lookup;
}

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

/**
 * Sales now read from the order ledger, not raw Stripe sessions: a single order
 * can span a deposit session, a balance session and monthly subscription
 * invoices, and counting sessions would triple-count it.
 */
export async function fetchKitSales(_secret?: string): Promise<{
  rows: KitSaleRow[];
  summary: KitSalesSummary;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const buyerLookup = await loadBuyerLookup();
  const { data, error } = await supabaseAdmin
    .from("kit_orders")
    .select("*")
    .neq("state", "draft")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows: KitSaleRow[] = (data ?? []).map((o) => {
    const matched = o.stripe_deposit_session_id ? buyerLookup[o.stripe_deposit_session_id] : undefined;
    const buyerType = o.buyer_type === "business" ? "business" : "personal";
    return {
      id: o.id,
      created: o.created_at,
      status: o.state,
      state: o.state,
      fulfilled: !!o.fulfilled_at,
      paid: o.collected_cents > 0,
      customerName: o.contact_name,
      customerEmail: o.contact_email,
      packageKey: o.package_key,
      packageLabel: o.package_label || PACKAGE_LABELS[o.package_key] || o.package_key,
      plan: o.path === "plan" ? "installments" : "full",
      currency: "AUD",
      listCents: o.list_cents || LIST_PRICE_CENTS[o.package_key] || 0,
      discountCents: o.discount_cents,
      promoCode: o.promo_code,
      promoPercent: o.promo_percent,
      shippingRegion: o.shipping_region,
      shippingCents: o.shipping_cents,
      shippingGstInclusive: o.shipping_gst_inclusive,
      collectedCents: o.collected_cents,
      contractCents: o.contract_cents,
      gstCents: o.gst_cents,
      monthsRemainingPlan:
        o.path === "plan" && o.plan_months !== null
          ? Math.max(0, o.plan_months - o.payments_made)
          : null,
      buyerType,
      buyerCategory: matched
        ? matched.category
        : buyerType === "business"
          ? "business_pending"
          : "private",
      businessName: matched?.businessName ?? o.business_name ?? null,
    };
  });

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
    byBuyer: (Object.keys(BUYER_CATEGORY_LABELS) as BuyerCategory[])
      .map((key) => {
        const matching = rows.filter((r) => r.buyerCategory === key);
        return {
          key,
          label: BUYER_CATEGORY_LABELS[key],
          count: matching.length,
          collectedCents: matching.reduce((a, r) => a + r.collectedCents, 0),
        };
      })
      .filter((b) => b.count > 0),
  };

  return { rows, summary };
}
