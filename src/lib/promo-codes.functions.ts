import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe secret key is not configured");
  return new Stripe(secret);
}

export interface PromoCodeRow {
  id: string;
  code: string;
  active: boolean;
  percent_off: number;
  max_redemptions: number | null;
  times_redeemed: number;
  coupon_id: string;
  coupon_name: string | null;
  created_at: number;
  expires_at: number | null;
}

export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoCodeRow[]> => {
    await requireSuperAdmin(context);
    const stripe = getStripe();

    const [codes, coupons] = await Promise.all([
      stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] }),
      stripe.coupons.list({ limit: 100 }),
    ]);

    const couponNameById = new Map<string, string | null>();
    for (const c of coupons.data) {
      couponNameById.set(c.id, c.name ?? null);
    }

    return codes.data.map((pc) => {
      const coupon = pc.promotion.coupon as Stripe.Coupon | string | null;
      const couponObj = typeof coupon === "object" && coupon ? coupon : null;
      const couponId = couponObj?.id ?? (typeof coupon === "string" ? coupon : "");
      return {
        id: pc.id,
        code: pc.code,
        active: pc.active,
        percent_off: couponObj?.percent_off ?? 0,
        max_redemptions: pc.max_redemptions ?? null,
        times_redeemed: pc.times_redeemed,
        coupon_id: couponId,
        coupon_name: couponObj?.name ?? couponNameById.get(couponId) ?? null,
        created_at: pc.created,
        expires_at: pc.expires_at ?? null,
      };
    });
  });

const CreateSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dashes and underscores only"),
  percent_off: z.number().int().min(1).max(100),
  max_redemptions: z.number().int().min(1).nullable().optional(),
});

export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const stripe = getStripe();

    const coupon = await stripe.coupons.create({
      percent_off: data.percent_off,
      duration: "once",
      name: `${data.percent_off}% off ResonaBed kit`,
    });

    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: data.code.toUpperCase(),
      max_redemptions: data.max_redemptions ?? undefined,
    });

    return { id: promo.id, code: promo.code, coupon_id: coupon.id };
  });

const ArchiveSchema = z.object({
  id: z.string().startsWith("promo_"),
  active: z.boolean(),
});

export const setPromoCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ArchiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const stripe = getStripe();
    await stripe.promotionCodes.update(data.id, { active: data.active });
    return { ok: true };
  });
