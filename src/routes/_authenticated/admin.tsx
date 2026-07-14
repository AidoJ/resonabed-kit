import { createFileRoute, redirect } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ResonaBed" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });
  if (isLoading) return null;
  const allowed =
    data?.roles.includes("super_admin") || data?.roles.includes("org_admin");
  if (!allowed) {
    throw redirect({ to: "/dashboard" });
  }
  return <ComingSoon title="Admin" />;
}
