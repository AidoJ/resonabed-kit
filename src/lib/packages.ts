/**
 * Single source of truth for the Resonabed product line and the deposit-first
 * money model. Browser-safe: pure data, no server imports.
 *
 * Every order, whichever package and whichever path, starts with a $100 order
 * deposit plus shipping. The balance is then paid either in full, or as a
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
  /** Plan: paid straight after the $100 deposit, then 10 monthlies. */
  plan: { depositBalanceCents: number; monthlyCents: number; months: number };
  /** Freight band: table packages ship a fitted therapy table. */
  shippingScope: "kit" | "table";
  /** Home is a consumer product and always takes the personal path. */
  personalOnly: boolean;
  description: string;
};

export const PACKAGES: Record<PackageKey, PackageDef> = {
  essentials: {
    key: "essentials",
    label: "Resonabed Basic",
    listCents: 119900,
    balanceCents: 109900,
    plan: { depositBalanceCents: 29900, monthlyCents: 9000, months: 10 },
    shippingScope: "kit",
    personalOnly: false,
    description:
      "Lean business system: 2x tactile speakers, Bluetooth amplifier, wiring and fittings, the full Resonabed business app and clinic webpage, 100 marketing flyers. Runs on a phone, tablet or laptop you already own.",
  },
  pro: {
    key: "pro",
    label: "Resonabed Pro",
    listCents: 139900,
    balanceCents: 129900,
    plan: { depositBalanceCents: 29900, monthlyCents: 11000, months: 10 },
    shippingScope: "kit",
    personalOnly: false,
    description:
      'Everything in Basic, plus a dedicated 10" tablet pre-configured for sessions, Audio-Technica ATH-M30x headphones and 100 disposable headphone covers.',
  },
  platinum: {
    key: "platinum",
    label: "Resonabed Platinum",
    listCents: 179900,
    balanceCents: 169900,
    plan: { depositBalanceCents: 49900, monthlyCents: 13000, months: 10 },
    shippingScope: "table",
    personalOnly: false,
    description:
      "Everything in Pro, on a new therapy table fully fitted and tested before it ships. The complete business in a box.",
  },
  home: {
    key: "home",
    label: "Resonabed for Home",
    listCents: 149900,
    balanceCents: 139900,
    plan: { depositBalanceCents: 39900, monthlyCents: 11000, months: 10 },
    shippingScope: "table",
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

/** Total contract value of a plan: $100 deposit + deposit balance + monthlies. */
export function planTotalCents(pkg: PackageDef) {
  return (
    ORDER_DEPOSIT_CENTS + pkg.plan.depositBalanceCents + pkg.plan.monthlyCents * pkg.plan.months
  );
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
