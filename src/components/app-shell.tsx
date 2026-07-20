import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Users,
  Waves,
  Music,
  Shield,
  LogOut,
  Calendar,
  Clock,
  Sparkles,
  Building2,
  BarChart3,
  Wrench,
  LifeBuoy,
  Settings,
  ClipboardList,
  ScrollText,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { exitSupportMode } from "@/lib/support-mode.functions";
import logo from "@/assets/resonabed-logo.svg.asset.json";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Role = "super_admin" | "org_admin" | "practitioner";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Three role-driven navigation trees. Each role sees ONLY its own tree.
function buildNav(roles: Role[], inSupportMode: boolean): NavGroup[] {
  if (roles.includes("super_admin")) {
    const groups: NavGroup[] = [
      {
        label: "Platform",
        items: [
          { to: "/admin/organisations", label: "Organisations", icon: Building2 },
          { to: "/admin/global-services", label: "Global services", icon: Wrench },
          { to: "/frequencies", label: "Global frequencies", icon: Waves },
          { to: "/audio", label: "Global audio", icon: Music },
          { to: "/admin/policy-templates", label: "Policy templates", icon: ScrollText },
          { to: "/admin/metrics", label: "Platform metrics", icon: BarChart3 },
        ],
      },
    ];
    if (inSupportMode) {
      groups.push({
        label: "Support access (clinic)",
        items: [
          { to: "/sessions", label: "Sessions", icon: Sparkles },
          { to: "/admin/clients", label: "Clients", icon: Users },
          { to: "/bookings", label: "Bookings", icon: Calendar },
          { to: "/availability", label: "Availability", icon: Clock },
        ],
      });
    }
    return groups;
  }

  if (roles.includes("org_admin")) {
    return [
      {
        label: "Clinic",
        items: [
          { to: "/sessions", label: "Sessions", icon: Sparkles },
          { to: "/admin/clients", label: "Clients", icon: Users },
          { to: "/bookings", label: "Bookings", icon: Calendar },
          { to: "/availability", label: "Availability", icon: Clock },
        ],
      },
      {
        label: "Administration",
        items: [
          { to: "/admin/team", label: "Team", icon: Users },
          { to: "/admin/services", label: "Services", icon: Wrench },
          { to: "/audio", label: "Audio library", icon: Music },
          { to: "/admin/reports", label: "Reports", icon: ClipboardList },
          { to: "/admin/settings", label: "Settings", icon: Settings },
        ],
      },

    ];
  }

  // Practitioner
  return [
    {
      label: "Clinic",
      items: [
        { to: "/sessions", label: "Sessions", icon: Sparkles },
        { to: "/clients", label: "Clients", icon: Users },
        { to: "/bookings", label: "My bookings", icon: Calendar },
        { to: "/availability", label: "My availability", icon: Clock },
      ],
    },
  ];
}

export function AppShell({ children }: { children: ReactNode }) {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  const roles = (data?.roles ?? []) as Role[];
  const roleLabel = roles.includes("super_admin")
    ? "Super admin"
    : roles.includes("org_admin")
      ? "Org admin"
      : roles.includes("practitioner")
        ? "Practitioner"
        : "No role";

  const support = data?.activeSupportSession ?? null;
  const inSupportMode = !!support;

  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (data?.mustChangePassword && currentPath !== "/change-password") {
      navigate({ to: "/change-password", replace: true });
    }
  }, [data?.mustChangePassword, currentPath, navigate]);

  useEffect(() => {
    const root = document.documentElement;
    const org = data?.org;
    const hex = /^#[0-9a-fA-F]{6}$/;
    const primary = org?.themePrimary && hex.test(org.themePrimary) ? org.themePrimary : null;
    const sidebar = org?.themeSidebar && hex.test(org.themeSidebar) ? org.themeSidebar : null;
    const accent = org?.themeAccent && hex.test(org.themeAccent) ? org.themeAccent : null;

    const lum = (h: string) => {
      const r = parseInt(h.slice(1, 3), 16),
        g = parseInt(h.slice(3, 5), 16),
        b = parseInt(h.slice(5, 7), 16);
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const fgFor = (h: string) => (lum(h) > 0.45 ? "#100a2e" : "#ffffff");

    const clearVars = [
      "--primary",
      "--primary-foreground",
      "--ring",
      "--sidebar-ring",
      "--sidebar",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-border",
      "--accent",
      "--accent-foreground",
      "--chart-1",
    ];
    for (const v of clearVars) root.style.removeProperty(v);

    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--primary-foreground", fgFor(primary));
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--sidebar-ring", primary);
      root.style.setProperty("--sidebar-primary", primary);
      root.style.setProperty("--sidebar-primary-foreground", fgFor(primary));
      root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${primary} 22%, transparent)`);
      root.style.setProperty("--chart-1", primary);
    }
    if (sidebar) {
      root.style.setProperty("--sidebar", sidebar);
      root.style.setProperty("--sidebar-foreground", fgFor(sidebar));
    }
    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-foreground", fgFor(accent));
    }
    return () => {
      for (const v of clearVars) root.style.removeProperty(v);
      root.style.removeProperty("--sidebar-foreground");
    };
  }, [
    data?.org?.themePrimary,
    data?.org?.themeSidebar,
    data?.org?.themeAccent,
  ]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const exitSupportFn = useServerFn(exitSupportMode);
  const exitMut = useMutation({
    mutationFn: () => exitSupportFn(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-context"] });
      navigate({ to: "/admin/organisations", replace: true });
    },
  });

  const nav = buildNav(roles, inSupportMode);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to + "/"));
    return (
      <SidebarMenuItem key={item.to + item.label}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className="h-11 rounded-lg text-[15px] font-normal text-white data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium hover:bg-sidebar-accent/60 hover:text-white"
        >
          <Link to={item.to} className="flex items-center gap-3">
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="px-5 pb-6 pt-6">
            <Link
              to="/dashboard"
              className="flex items-center justify-center rounded-2xl bg-white/95 px-4 py-5"
            >
              <img
                src={data?.org?.logoSignedUrl ?? logo.url}
                alt={data?.org?.name ?? "Resonabed"}
                className="h-[4.6875rem] w-auto object-contain"
                draggable={false}
              />
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-2">
            {nav.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="px-3 pt-2 text-[11px] uppercase tracking-[0.14em] text-white/70">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter className="px-3 pb-4">
            <Button
              variant="ghost"
              className="h-11 w-full justify-start rounded-lg text-white hover:bg-sidebar-accent/60 hover:text-white"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-[18px] w-[18px]" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          {inSupportMode && (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 border-b border-amber-500/40 bg-amber-500/15 px-6 py-2 text-sm text-amber-100"
            >
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" />
                <span>
                  Support mode — viewing <strong>{support!.org_name}</strong>
                  {support!.reason ? <> · {support!.reason}</> : null}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => exitMut.mutate()}
                disabled={exitMut.isPending}
              >
                Exit support mode
              </Button>
            </div>
          )}
          <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-card px-6">
            <SidebarTrigger className="text-brand-indigo" />
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-[15px] font-medium text-foreground">
                    {inSupportMode
                      ? support!.org_name
                      : data?.org?.name ?? (roles.includes("super_admin") ? "Resonabed platform" : "No organisation assigned")}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-secondary-foreground">
                    {roleLabel}
                  </span>
                  {inSupportMode && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-amber-200">
                      <Shield className="h-3 w-3" /> Support
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">
              {data?.displayName ?? data?.email}
            </div>
          </header>
          <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
