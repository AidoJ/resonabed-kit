import { SITE_URL } from "@/lib/seo";
import type { KitPricing } from "@/lib/packages";

/** Package card copy, shared by the cards and the Product structured data. */
export const CARD_DESCRIPTIONS = {
  essentials:
    "The complete business system, running on the phone, tablet or laptop you already use. Fits the treatment table already in your room.",
  pro: "Everything in Basic, plus the dedicated hardware for a hands-off client experience. Fitted to the treatment table in your room.",
  platinum:
    "Everything in Pro, on a new therapy table with the system fully fitted and tested before it ships. A complete business in a box, ready to run from the moment it arrives.",
  home: "The full vibroacoustic experience for yourself, family and friends, on a fully fitted table with the personal app included at no ongoing cost.",
} as const;

/**
 * Product + Offer per package, from the same prices the cards show. The Offer
 * is always the full GST-inclusive price: never the deposit, a plan payment or
 * shipping (those stay as visible text only).
 */
export function packagesJsonLd(pricing: KitPricing) {
  const cards = [
    ["essentials", CARD_DESCRIPTIONS.essentials, "packages"],
    ["pro", CARD_DESCRIPTIONS.pro, "packages"],
    ["platinum", CARD_DESCRIPTIONS.platinum, "packages"],
    ["home", CARD_DESCRIPTIONS.home, "home-package"],
  ] as const;
  return {
    "@context": "https://schema.org",
    "@graph": cards.map(([key, description, anchor]) => {
      const pkg = pricing.packages[key];
      const price = (pkg.listCents / 100).toFixed(2);
      return {
        "@type": "Product",
        name: pkg.label,
        description,
        brand: { "@type": "Brand", name: "Resonabed" },
        url: `${SITE_URL}/#${anchor}`,
        offers: {
          "@type": "Offer",
          price,
          priceCurrency: "AUD",
          priceSpecification: {
            "@type": "PriceSpecification",
            price,
            priceCurrency: "AUD",
            valueAddedTaxIncluded: true,
          },
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/#${anchor}`,
          seller: { "@id": `${SITE_URL}/#organization` },
        },
      };
    }),
  };
}
