/**
 * Shared search-engine helpers. Browser-safe: pure data, no server imports.
 * Every canonical, og:url and structured-data URL uses SITE_URL (no www).
 */
export const SITE_URL = "https://resonabed.com";

/** Absolute URL for a site path ("/research" -> "https://resonabed.com/research"). */
export function absoluteUrl(path: string) {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

/** Site-wide Organization structured data. Only facts the owner supplied. */
export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Resonabed",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  email: "info@resonabed.com",
  telephone: "+61494825281",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Scarborough",
    addressRegion: "QLD",
    addressCountry: "AU",
  },
  areaServed: "AU",
  // Social profile links to be supplied by the owner.
  sameAs: [] as string[],
};

export type Crumb = { name: string; path: string };

/** BreadcrumbList for every page except the homepage. Home is always first. */
export function breadcrumbJsonLd(trail: Crumb[]) {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** Script entry for a route head(). */
export function jsonLdScript(data: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}
