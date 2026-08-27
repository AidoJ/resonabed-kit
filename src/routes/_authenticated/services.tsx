import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "Services, ResonaBed" },
      { name: "description", content: "The services your clinic offers, with pricing and session lengths." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/admin/services" });
  },
});
