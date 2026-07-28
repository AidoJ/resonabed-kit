import { createFileRoute, redirect, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  Users,
  Wrench,
  BarChart3,
  UserCog,
  Settings,
  Building2,
  Waves,
  Music,
  Tag,
  Truck,
  Receipt,
  FileText,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ResonaBed" }] }),
  component: AdminLayout,
});

type Tab = { to: string; label: string; icon: typeof BarChart3; exact?: boolean };

const SUPER_TABS: Tab[] = [
  { to: "/admin/organisations", label: "Organisations", icon: Building2 },
  { to: "/admin/global-services", label: "Global services", icon: Wrench },
  { to: "/frequencies", label: "Global frequencies", icon: Waves },
  { to: "/audio", label: "Global audio", icon: Music },
  { to: "/admin/promo-codes", label: "Promo codes", icon: Tag },
  { to: "/admin/shipping", label: "Shipping rates", icon: Truck },
  { to: "/admin/sales", label: "Kit purchases", icon: Receipt },
  { to: "/admin/invoices", label: "Invoices", icon: FileText },
  { to: "/admin/payments", label: "Payments", icon: Banknote },
  { to: "/admin/metrics", label: "Platform metrics", icon: BarChart3 },
];

const ORG_ADMIN_TABS: Tab[] = [
  { to: "/admin/team", label: "Team", icon: UserCog },
  { to: "/admin/services", label: "Services", icon: Wrench },
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

  const roles = data?.roles ?? [];
  const isSuper = roles.includes("super_admin");
  const isOrgAdmin = roles.includes("org_admin");
  if (!isSuper && !isOrgAdmin) throw redirect({ to: "/dashboard" });

  const tabs = isSuper ? SUPER_TABS : ORG_ADMIN_TABS;
  const title = isSuper ? "Platform administration" : "Clinic administration";
  const subtitle = isSuper
    ? "Organisations, global content, and platform-level metrics."
    : "Your team, services, clients, reports and settings.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => {
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
