import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Users,
  ClipboardList,
  Waves,
  Music,
  Shield,
  LogOut,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "@/lib/user-context.functions";
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
  roles: readonly Role[] | null;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/sessions", label: "Sessions", icon: Sparkles, roles: null },
  { to: "/admin/clients", label: "Clients", icon: Users, roles: ["super_admin", "org_admin"] },
  { to: "/clients", label: "Clients", icon: Users, roles: ["practitioner"] },
  { to: "/frequencies", label: "Frequencies", icon: Waves, roles: null },
  { to: "/audio", label: "Audio library", icon: Music, roles: null },
];

const SCHEDULING_NAV: NavItem[] = [
  { to: "/bookings", label: "Bookings", icon: Calendar, roles: null },
  { to: "/availability", label: "Availability", icon: Clock, roles: null },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Admin", icon: Shield, roles: ["super_admin", "org_admin"] },
];

function filterNav(items: NavItem[], roles: readonly Role[]) {
  return items.filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)));
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

  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (data?.mustChangePassword && currentPath !== "/change-password") {
      navigate({ to: "/change-password", replace: true });
    }
  }, [data?.mustChangePassword, currentPath, navigate]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primary = filterNav(PRIMARY_NAV, roles);
  const scheduling = filterNav(SCHEDULING_NAV, roles);
  const admin = filterNav(ADMIN_NAV, roles);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to + "/"));
    return (
      <SidebarMenuItem key={item.to + item.label}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className="h-11 rounded-lg text-[15px] font-normal text-sidebar-foreground/85 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
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
                src={logo.url}
                alt="Resonabed"
                className="h-10 w-auto"
                draggable={false}
              />
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 pt-2 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
                Session
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{primary.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {scheduling.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-3 pt-2 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
                  Diary
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{scheduling.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {admin.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-3 pt-2 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
                  Administration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{admin.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="px-3 pb-4">
            <Button
              variant="ghost"
              className="h-11 w-full justify-start rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-[18px] w-[18px]" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-card px-6">
            <SidebarTrigger className="text-brand-indigo" />
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-[15px] font-medium text-foreground">
                    {data?.org?.name ?? "No organisation assigned"}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-secondary-foreground">
                    {roleLabel}
                  </span>
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
