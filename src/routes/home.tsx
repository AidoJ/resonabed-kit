import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for the personal (home-user) app. Deliberately has no gate of its
 * own so /home/signup and /home/login stay public, the gate lives on the
 * signed-in pages.
 */
export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Resonabed Home App" },
      { name: "description", content: "Your personal Resonabed app for vibroacoustic sessions at home." },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: () => <Outlet />,
});
