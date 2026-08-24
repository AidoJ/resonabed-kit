/**
 * Kit pricing server functions: a public read for the marketing site and a
 * super-admin write for the pricing admin page. Prices are public data (they
 * are printed on the website), backed by the kit_package_prices table.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORDER_DEPOSIT_CENTS,
  applyPricing,
  type KitPricing,
} from "@/lib/packages";
import { mapPriceRows } from "@/lib/pricing.server";

const PRICE_SELECT =
  "package_key, list_cents, plan_deposit_balance_cents, plan_monthly_cents, plan_months";

/** Public: current kit prices for the website. Falls back to static defaults. */
export const getKitPricing = createServerFn({ method: "GET" }).handler(
  async (): Promise<KitPricing> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const [{ data: rows }, { data: dep }] = await Promise.all([
      supabasePublic.from("kit_package_prices").select(PRICE_SELECT),
      supabasePublic
        .from("app_settings")
        .select("value")
        .eq("key", "order_deposit_cents")
        .maybeSingle(),
    ]);
    const parsed = Number(dep?.value);
    const depositCents =
      Number.isInteger(parsed) && parsed > 0 ? parsed : ORDER_DEPOSIT_CENTS;
    return applyPricing(mapPriceRows(rows), depositCents);
  },
);

const PriceInput = z.object({
  packageKey: z.enum(["essentials", "pro", "platinum", "home"]),
  listCents: z.number().int().min(1000).max(100_000_00),
  planDepositBalanceCents: z.number().int().min(1000).max(100_000_00),
  planMonthlyCents: z.number().int().min(1000).max(100_000_00),
  planMonths: z.number().int().min(1).max(36),
});

/** Super admin: update one package's price and plan terms. */
export const setKitPackagePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PriceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Only super admins can change kit pricing");
    const { error } = await context.supabase
      .from("kit_package_prices")
      .update({
        list_cents: data.listCents,
        plan_deposit_balance_cents: data.planDepositBalanceCents,
        plan_monthly_cents: data.planMonthlyCents,
        plan_months: data.planMonths,
        updated_by: context.userId,
      })
      .eq("package_key", data.packageKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Super admin: update the global order deposit. */
export const setOrderDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ depositCents: z.number().int().min(100).max(10_000_00) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Only super admins can change the order deposit");
    const { error } = await context.supabase.from("app_settings").upsert(
      {
        key: "order_deposit_cents",
        value: String(data.depositCents),
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
