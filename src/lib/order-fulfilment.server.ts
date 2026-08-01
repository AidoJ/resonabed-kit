/**
 * Shared post-payment fulfilment for kit checkout sessions.
 *
 * One place decides what a paid order becomes, so the Stripe webhook and the
 * /order/success finalise call can never disagree:
 *   - personal buyer  -> home-app access code, issued and emailed immediately
 *   - business buyer  -> clinic onboarding queue entry for a human to provision
 *
 * Both branches are idempotent on the Stripe checkout session id.
 */
import type Stripe from "stripe";

export type FulfilmentResult = {
  buyerType: "personal" | "business";
  /** Email the home access code went to, personal buyers only. */
  codeEmail: string | null;
  /** True when a business order was queued for clinic onboarding. */
  queuedForOnboarding: boolean;
};

function meta(session: Stripe.Checkout.Session, key: string): string | null {
  const v = session.metadata?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<FulfilmentResult> {
  const buyerType = meta(session, "buyer_type") === "business" ? "business" : "personal";
  const email =
    meta(session, "contact_email") ??
    session.customer_details?.email ??
    (session.customer_email as string | null) ??
    null;

  if (!email) {
    console.error("Paid checkout session with no email", session.id);
    return { buyerType, codeEmail: null, queuedForOnboarding: false };
  }

  const addr = session.customer_details?.address;
  const shippingAddress = addr
    ? [addr.line1, addr.line2, `${addr.city ?? ""} ${addr.state ?? ""} ${addr.postal_code ?? ""}`.trim(), addr.country]
        .filter(Boolean)
        .join("\n")
    : null;

  if (buyerType === "business") {
    const { recordOnboardingOrder } = await import("@/lib/onboarding.server");
    const queued = await recordOnboardingOrder({
      source: "stripe",
      sourceRef: session.id,
      businessName: meta(session, "business_name"),
      abn: meta(session, "abn"),
      contactName: meta(session, "contact_name") ?? session.customer_details?.name ?? null,
      contactEmail: email,
      contactPhone: meta(session, "contact_phone") ?? session.customer_details?.phone ?? null,
      packageKey: meta(session, "package"),
      plan: meta(session, "plan"),
      shippingAddress,
      amountCents: session.amount_total ?? null,
      notes: "Website card order.",
    });
    return { buyerType, codeEmail: null, queuedForOnboarding: !queued.alreadyExisted };
  }

  const { issueAccessCode } = await import("@/lib/home-access.server");
  const issued = await issueAccessCode({
    buyerEmail: email,
    buyerName: meta(session, "contact_name") ?? session.customer_details?.name ?? null,
    buyerPhone: session.customer_details?.phone ?? null,
    packageKey: meta(session, "package"),
    source: "stripe",
    sourceRef: session.id,
    buyerType: "personal",
  });
  return { buyerType, codeEmail: issued.buyerEmail, queuedForOnboarding: false };
}
