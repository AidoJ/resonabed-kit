import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired page. The Home package now lives on the main landing page. */
export const Route = createFileRoute("/for-home")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "home-package" });
  },
});
