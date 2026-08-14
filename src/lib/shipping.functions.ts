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

const APPLIES_TO = ["any", "essentials", "pro", "platinum", "home"] as const;

const csvList = z
  .array(z.string().trim().min(1).max(8))
  .max(60)
  .transform((v) => v.map((s) => s.toUpperCase()));

const UpdateSchema = z.object({
  id: z.string().uuid(),
  region: z.string().trim().min(2).max(60).optional(),
  label: z.string().trim().min(2).max(120).optional(),
  amount_cents: z.number().int().min(0).max(1_000_000).optional(),
  gst_inclusive: z.boolean().optional(),
  allowed_countries: csvList.optional(),
  allowed_states: csvList.optional(),
  applies_to: z.enum(APPLIES_TO).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const updateShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { id, ...patch } = data;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shipping_rates").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateSchema = z.object({
  region: z.string().trim().min(2).max(60),
  label: z.string().trim().min(2).max(120),
  amount_cents: z.number().int().min(0).max(1_000_000),
  gst_inclusive: z.boolean(),
  allowed_countries: csvList.refine((v) => v.length > 0, "Add at least one country"),
  allowed_states: csvList,
  applies_to: z.enum(APPLIES_TO),
  sort_order: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export const createShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shipping_rates").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shipping_rates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

