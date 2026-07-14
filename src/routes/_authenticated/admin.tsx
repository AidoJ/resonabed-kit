import { createFileRoute, redirect, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { Users, Wrench, BarChart3, UserCog, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ResonaBed" }] }),
  component: AdminLayout,
});

const TABS: { to: string; label: string; icon: typeof BarChart3; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/team", label: "Team", icon: UserCog },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (isLoading) return null;
  const allowed = data?.roles.includes("super_admin") || data?.roles.includes("org_admin");
  if (!allowed) throw redirect({ to: "/dashboard" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organisation, team, services, clients and reports.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to as "/admin"}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
