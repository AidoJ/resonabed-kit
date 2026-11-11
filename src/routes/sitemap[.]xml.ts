import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import {
  isSitemapRouteIncluded,
  sitemapPathForLocation,
  sitemapStaticEntries,
  sitemapXML,
  type SitemapEntry,
} from "@/lib/sitemap";

const BASE_URL = "https://resonabed.com";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticEntries(router);

        // Clinic pages: only clinics opted into the directory are listed.
        const clinicRouteId = "/o/$slug";
        const directoryRouteId = "/practitioners";
        const clinicsIncluded = isSitemapRouteIncluded(router.routesById[clinicRouteId]);
        const directoryIncluded = isSitemapRouteIncluded(router.routesById[directoryRouteId]);
        if (clinicsIncluded || directoryIncluded) {
          const { fetchDirectoryClinics } = await import("@/lib/directory.server");
          const clinics = await fetchDirectoryClinics(); // throws on failure: no partial XML
          const day = (iso: string) => iso.slice(0, 10);
          if (clinicsIncluded) {
            for (const c of clinics) {
              const location = router.buildLocation({
                to: "/o/$slug",
                params: { slug: c.slug },
                search: () => ({}),
                hash: "",
              });
              const path = sitemapPathForLocation(router, location, clinicRouteId);
              if (path) entries.push({ path, lastmod: day(c.updated_at) });
            }
          }
          // The directory page changes whenever a listed clinic does.
          if (directoryIncluded && clinics.length > 0) {
            const newest = clinics.map((c) => c.updated_at).sort().at(-1)!;
            const i = entries.findIndex((e) => e.path === "/practitioners");
            if (i >= 0) entries[i] = { path: "/practitioners", lastmod: day(newest) };
          }
        }

        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
