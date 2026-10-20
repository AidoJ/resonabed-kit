import { z } from "zod";

export const PromoDiscountSchema = z.discriminatedUnion("discount_type", [
  z.object({ discount_type: z.literal("percentage"), percent_off: z.number().int().min(1).max(99) }),
  z.object({ discount_type: z.literal("fixed"), fixed_amount_cents: z.number().int().positive().max(2147483647) }),
]);

/** Both kinds discount the kit balance only; preserve the minimum card charge. */
export function calculatePromoDiscount(listCents: number, balanceCents: number, percent: number, fixedCents: number | null) {
  const amount = fixedCents ?? Math.floor((listCents * percent) / 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || balanceCents - amount < 50) {
    throw new Error("This promo code discount is too high for checkout");
  }
  return amount;
}