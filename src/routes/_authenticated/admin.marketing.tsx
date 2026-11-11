import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getOrgSettings } from "@/lib/admin.functions";
import { FlyerEditor } from "@/components/flyer-editor";

const settingsQuery = { queryKey: ["org-settings", "marketing"], queryFn: () => getOrgSettings() };
export const Route = createFileRoute("/_authenticated/admin/marketing")({
  staticData: { sitemap: false },
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  head: () => ({ meta: [
    { title: "Flyer editor · ResonaBed Marketing" },
    { name: "description", content: "Personalise your six-panel ResonaBed flyer with clinic logo, phone number and panel colours." },
    { property: "og:title", content: "Flyer editor · ResonaBed Marketing" },
    { property: "og:description", content: "Create your clinic's colour-coordinated ResonaBed DL flyer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: MarketingPage,
});
function MarketingPage() {
  const { data: clinic } = useSuspenseQuery(settingsQuery);
  return <FlyerEditor key={clinic?.id ?? "reference"} clinic={clinic} />;
}
