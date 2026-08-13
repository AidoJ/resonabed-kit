import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ShippingRateRow {
  id: string;
  region: string;
  label: string;
  amount_cents: number;
  gst_inclusive: boolean;
  allowed_countries: string[];
  allowed_states: string[];
  /** 'kit' | 'table' | 'any'. Table bands cover the fitted home table freight. */
  applies_to: string;
  active: boolean;
  sort_order: number;
}

/**
 * Public server fn, returns active shipping rates so the shipping-step
 * dialog can render the picker. No sensitive data.
 */
export const getShippingRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShippingRateRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shipping_rates")
      .select("id, region, label, amount_cents, gst_inclusive, allowed_countries, allowed_states, applies_to, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ShippingRateRow[];
  },
);

async function requireSuperAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Admin list, includes inactive rows too, for the editor. */
export const listShippingRatesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShippingRateRow[]> => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shipping_rates")
      .select("id, region, label, amount_cents, gst_inclusive, allowed_countries, allowed_states, applies_to, active, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ShippingRateRow[];
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  amount_cents: z.number().int().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
});

export const updateShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const patch: { amount_cents?: number; active?: boolean } = {};
    if (data.amount_cents !== undefined) patch.amount_cents = data.amount_cents;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shipping_rates")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
