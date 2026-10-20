import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PromoDiscountSchema } from "@/lib/promo-discounts";

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

export interface PromoCodeRow {
  id: string;
  code: string;
  active: boolean;
  percent_off: number;
  fixed_amount_cents: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  created_at: string;
}

export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoCodeRow[]> => {
    await requireSuperAdmin(context);

    const { data, error } = await context.supabase
      .from("promo_codes")
      .select("id, code, active, discount_percent, fixed_amount_cents, max_redemptions, times_redeemed, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((pc) => ({
      id: pc.id,
      code: pc.code,
      active: pc.active,
      percent_off: pc.discount_percent,
      fixed_amount_cents: pc.fixed_amount_cents,
      max_redemptions: pc.max_redemptions,
      times_redeemed: pc.times_redeemed,
      created_at: pc.created_at,
    }));
  });

const CreateSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dashes and underscores only"),
  max_redemptions: z.number().int().min(1).nullable().optional(),
}).and(PromoDiscountSchema);

export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);

    const normalizedCode = data.code.trim().toUpperCase();
    const { data: promo, error } = await context.supabase
      .from("promo_codes")
      .insert({
        code: normalizedCode,
        discount_percent: data.discount_type === "percentage" ? data.percent_off : 1,
        fixed_amount_cents: data.discount_type === "fixed" ? data.fixed_amount_cents : null,
        max_redemptions: data.max_redemptions ?? null,
        created_by: context.userId,
      })
      .select("id, code")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("That promo code already exists");
      throw new Error(error.message);
    }

    return { id: promo.id, code: promo.code };
  });

const ArchiveSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export const setPromoCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ArchiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);

    const { error } = await context.supabase
      .from("promo_codes")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
