import { createFileRoute } from "@tanstack/react-router";
import { TableSetupVideos } from "@/components/table-setup-videos";

export const Route = createFileRoute("/_authenticated/table-setup")({
  head: () => ({
    meta: [
      { title: "Table setup, ResonaBed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TableSetupPage,
});

function TableSetupPage() {
  return <TableSetupVideos />;
}
