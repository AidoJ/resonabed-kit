import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/audio")({
  head: () => ({ meta: [{ title: "Audio library — ResonaBed" }] }),
  component: () => <ComingSoon title="Audio library" />,
});
