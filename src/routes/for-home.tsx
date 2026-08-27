import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired page. The Home package now lives on the main landing page. */
export const Route = createFileRoute("/for-home")({
  head: () => ({
    meta: [
      { title: "Resonabed for Home | Personal Vibroacoustic Kit" },
      { name: "description", content: "Resonabed for home: a personal vibroacoustic kit with a simple app for running sessions in your own space." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "home-package" });
  },
});
