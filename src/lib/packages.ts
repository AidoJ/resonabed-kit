/**
 * Single source of truth for the Resonabed product line and the deposit-first
 * money model. Browser-safe: pure data, no server imports.
 *
 * Every order, whichever package and whichever path, starts with a $100 order
 * deposit. Shipping is quoted at deposit time and charged with the balance,
 * which is then paid either in full, or as a
 * "deposit balance" followed by exactly 10 monthly payments.
 */

export const ORDER_DEPOSIT_CENTS = 10000;

export type PackageKey = "essentials" | "pro" | "platinum" | "home";

export type PackageDef = {
  key: PackageKey;
  /** Customer-facing name. */
  label: string;
  /** Pay-in-full price incl. GST. */
  listCents: number;
  /** Pay-in-full price minus the $100 order deposit. */
  balanceCents: number;
  /** Total payable when the customer spreads payments (a premium over list). */
  planListCents: number;
  /** Plan: paid straight after the $100 deposit, then 10 monthlies. */
  plan: { depositBalanceCents: number; monthlyCents: number; months: number };
  /** Freight band key: each package has its own shipping_rates rows. */
  shippingScope: PackageKey;
  /** Packages that ship a fitted therapy table. */
  shipsTable: boolean;
  /** Home is a consumer product and always takes the personal path. */
  personalOnly: boolean;
  description: string;
};

export const PACKAGES: Record<PackageKey, PackageDef> = {
  essentials: {
    key: "essentials",
    label: "Resonabed Basic",
    listCents: 129900,
    balanceCents: 119900,
    planListCents: 139900,
    plan: { depositBalanceCents: 29900, monthlyCents: 10000, months: 10 },
    shippingScope: "essentials",
    shipsTable: false,
    personalOnly: false,
    description:
      "Lean business system: 2x tactile speakers, Bluetooth amplifier, wiring and fittings, the full Resonabed business app and clinic webpage, 100 marketing flyers. Runs on a phone, tablet or laptop you already own.",
  },
  pro: {
    key: "pro",
    label: "Resonabed Pro",
    listCents: 149900,
    balanceCents: 139900,
    planListCents: 159900,
    plan: { depositBalanceCents: 39900, monthlyCents: 11000, months: 10 },
    shippingScope: "pro",
    shipsTable: false,
    personalOnly: false,
    description:
      'Everything in Basic, plus a dedicated 10" tablet pre-configured for sessions, Audio-Technica ATH-M30x headphones and 100 disposable headphone covers.',
  },
  platinum: {
    key: "platinum",
    label: "Resonabed Platinum",
    listCents: 199900,
    balanceCents: 189900,
    planListCents: 209900,
    plan: { depositBalanceCents: 59900, monthlyCents: 14000, months: 10 },
    shippingScope: "platinum",
    shipsTable: true,
    personalOnly: false,
    description:
      "Everything in Pro, on a new therapy table fully fitted and tested before it ships. The complete business in a box.",
  },
  home: {
    key: "home",
    label: "Resonabed for Home",
    listCents: 159900,
    balanceCents: 149900,
    planListCents: 169900,
    plan: { depositBalanceCents: 49900, monthlyCents: 11000, months: 10 },
    shippingScope: "home",
    shipsTable: true,
    personalOnly: true,
    description:
      'Complete home package: therapy table fully fitted with 2x 50W tactile speakers, Bluetooth amplifier, wiring and fittings, a 10" tablet, Audio-Technica ATH-M30x headphones, the personal Resonabed app with a perpetual licence and the 9 Solfeggio frequencies.',
  },
};

export const PACKAGE_KEYS = ["essentials", "pro", "platinum", "home"] as const;

export const PACKAGE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(PACKAGES).map((p) => [p.key, p.label]),
);

export function isPackageKey(value: unknown): value is PackageKey {
  return typeof value === "string" && value in PACKAGES;
}

/** Total contract value of a plan: order deposit + deposit balance + monthlies. */
export function planTotalCents(pkg: PackageDef, depositCents = ORDER_DEPOSIT_CENTS) {
  return depositCents + pkg.plan.depositBalanceCents + pkg.plan.monthlyCents * pkg.plan.months;
}

/** GST is 1/11 of a GST-inclusive amount (Australia, 10%). */
export function gstOf(inclusiveCents: number) {
  return Math.round(inclusiveCents / 11);
}

export function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "$1,090 + $109 GST = $1,199" for a GST-inclusive price. */
export function gstSplitLine(cents: number) {
  const gst = gstOf(cents);
  return `${money(cents - gst)} + ${money(gst)} GST = ${money(cents)}`;
}

/* ------------------------------------------------------- editable pricing */

/**
 * Prices are editable by super admins and stored in `kit_package_prices` (plus
 * the `order_deposit_cents` app setting). The constants above are the defaults;
 * `applyPricing` merges saved rows over them. Browser-safe.
 */
export type KitPriceRow = {
  packageKey: PackageKey;
  listCents: number;
  planListCents: number;
  planDepositBalanceCents: number;
  planMonthlyCents: number;
  planMonths: number;
};

export type KitPricing = {
  depositCents: number;
  packages: Record<PackageKey, PackageDef>;
};

export function applyPricing(
  rows: KitPriceRow[],
  depositCents: number = ORDER_DEPOSIT_CENTS,
): KitPricing {
  const byKey = new Map(rows.map((r) => [r.packageKey, r]));
  const packages = Object.fromEntries(
    Object.values(PACKAGES).map((p) => {
      const row = byKey.get(p.key);
      if (!row) return [p.key, p];
      const def: PackageDef = {
        ...p,
        listCents: row.listCents,
        balanceCents: Math.max(0, row.listCents - depositCents),
        planListCents: row.planListCents,
        plan: {
          depositBalanceCents: row.planDepositBalanceCents,
          monthlyCents: row.planMonthlyCents,
          months: row.planMonths,
        },
      };
      return [p.key, def];
    }),
  ) as Record<PackageKey, PackageDef>;
  return { depositCents, packages };
}
