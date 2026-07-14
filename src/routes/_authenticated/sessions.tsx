import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/sessions")({
  head: () => ({ meta: [{ title: "Sessions — ResonaBed" }] }),
  component: () => <ComingSoon title="Sessions" />,
});
