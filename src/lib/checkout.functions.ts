/**
 * Thin server-function wrappers for the deposit-first checkout. All logic
 * lives in checkout.server.ts / orders.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  BalanceCheckoutSchema,
  DepositCheckoutSchema,
  EftOrderSchema,
  FinalizeSchema,
  PromoSchema,
  TokenSchema,
} from "@/lib/checkout.server";

export type { BusinessDetails } from "@/lib/checkout.server";

/** Step 1: $100 order deposit only. Creates the order record and locks the freight quote. */
export const createKitCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DepositCheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { createDepositCheckout } = await import("@/lib/checkout.server");
    return await createDepositCheckout(data);
  });

/** Step 2: balance in full, or the deposit balance plus 10 monthly payments. */
export const createBalanceCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BalanceCheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { createBalanceCheckout } = await import("@/lib/checkout.server");
    return await createBalanceCheckout(data);
  });

/** Reads an order from its private balance-link token. */
export const getOrderByBalanceToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { loadOrderForToken } = await import("@/lib/checkout.server");
    return await loadOrderForToken(data.token);
  });

/** Raises an EFT balance invoice for an order whose deposit has cleared. */
export const requestBalanceEftInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { requestEftBalance } = await import("@/lib/checkout.server");
    return await requestEftBalance(data.token);
  });

/**
 * Runs after Stripe returns to /order/success. The webhook is the source of
 * truth; this repeats the same idempotent transition so a delayed webhook can
 * never strand a buyer.
 */
export const finalizeCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizeSchema.parse(input))
  .handler(async ({ data }) => {
    const { finalizeSession } = await import("@/lib/checkout.server");
    return await finalizeSession(data.sessionId);
  });

export const finalizeInstallmentsPlan = finalizeCheckoutSession;

export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["STRIPE_PUBLISHABLE_KEY"];
  if (!key) throw new Error("Stripe publishable key is not configured");
  return { publishableKey: key };
});

export const validatePromoCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PromoSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolvePromo } = await import("@/lib/checkout.server");
    const { PACKAGES } = await import("@/lib/packages");
    const promo = await resolvePromo(data.package, data.promoCode);
    if (!promo) throw new Error("That promo code is not active");
    return {
      code: promo.code,
      percentOff: promo.percentOff,
      originalAmount: PACKAGES[data.package].listCents,
      amountDiscounted: promo.amountDiscounted,
      payableAmount: promo.payableAmount,
    };
  });

/** EFT alternative to card: raises the deposit invoice and returns bank details. */
export const requestKitEftInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EftOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { createEftDepositOrder } = await import("@/lib/checkout.server");
    return await createEftDepositOrder(data);
  });
