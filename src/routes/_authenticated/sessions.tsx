import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sessions")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Sessions, ResonaBed" },
      { name: "description", content: "Your clinic's vibroacoustic session records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
