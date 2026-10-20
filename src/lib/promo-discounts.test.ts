import { describe, expect, it } from "vitest";
import { calculatePromoDiscount, PromoDiscountSchema } from "./promo-discounts";

describe("promo discount types", () => {
  it("takes a fixed monetary amount rather than a percentage", () => {
    expect(calculatePromoDiscount(159900, 149900, 1, 20000)).toBe(20000);
  });
  it("preserves percentage calculations", () => {
    expect(calculatePromoDiscount(159900, 149900, 10, null)).toBe(15990);
  });
  it("accepts fixed amounts including cents", () => {
    expect(PromoDiscountSchema.parse({ discount_type: "fixed", fixed_amount_cents: 20025 }).fixed_amount_cents).toBe(20025);
  });
  it("rejects zero fixed discounts", () => {
    expect(PromoDiscountSchema.safeParse({ discount_type: "fixed", fixed_amount_cents: 0 }).success).toBe(false);
  });
  it("rejects fractional cents", () => {
    expect(PromoDiscountSchema.safeParse({ discount_type: "fixed", fixed_amount_cents: 20.5 }).success).toBe(false);
  });
  it("keeps the deposit and minimum balance intact", () => {
    expect(() => calculatePromoDiscount(159900, 149900, 1, 149851)).toThrow();
    expect(calculatePromoDiscount(159900, 149900, 1, 149850)).toBe(149850);
  });
});