/**
 * Server-side pricing resolver: merges the super-admin editable rows in
 * `kit_package_prices` (and the `order_deposit_cents` app setting) over the
 * static defaults in packages.ts. Every order-creation path resolves prices
 * through here so an admin price change applies to new orders only; existing
 * orders keep the figures stored on their own row.
 */
import {
  ORDER_DEPOSIT_CENTS,
  applyPricing,
  type KitPriceRow,
  type KitPricing,
  type PackageKey,
} from "@/lib/packages";

export function mapPriceRows(
  rows:
    | {
        package_key: string;
        list_cents: number;
        plan_deposit_balance_cents: number;
        plan_monthly_cents: number;
        plan_months: number;
      }[]
    | null,
): KitPriceRow[] {
  return (rows ?? []).map((r) => ({
    packageKey: r.package_key as PackageKey,
    listCents: r.list_cents,
    planDepositBalanceCents: r.plan_deposit_balance_cents,
    planMonthlyCents: r.plan_monthly_cents,
    planMonths: r.plan_months,
  }));
}

export async function resolveKitPricing(): Promise<KitPricing> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: rows }, { data: dep }] = await Promise.all([
    supabaseAdmin
      .from("kit_package_prices")
      .select("package_key, list_cents, plan_deposit_balance_cents, plan_monthly_cents, plan_months"),
    supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "order_deposit_cents")
      .maybeSingle(),
  ]);
  const parsed = Number(dep?.value);
  const depositCents = Number.isInteger(parsed) && parsed > 0 ? parsed : ORDER_DEPOSIT_CENTS;
  return applyPricing(mapPriceRows(rows), depositCents);
}
