import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Users, ClipboardList, Waves, Music, Shield, LogOut, Calendar, Clock } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "@/lib/user-context.functions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: Waves, roles: null },
  { to: "/bookings", label: "Bookings", icon: Calendar, roles: null },
  { to: "/availability", label: "Availability", icon: Clock, roles: null },
  { to: "/sessions", label: "Sessions", icon: ClipboardList, roles: null },
  { to: "/frequencies", label: "Frequencies", icon: Waves, roles: null },
  { to: "/audio", label: "Audio library", icon: Music, roles: null },
  { to: "/admin/clients", label: "Clients", icon: Users, roles: ["super_admin", "org_admin"] as const },
  {
    to: "/admin",
    label: "Admin",
    icon: Shield,
    roles: ["super_admin", "org_admin"] as const,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  const roles = data?.roles ?? [];
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

  // Force-change-password interceptor: signed-in users with must_change_password=true
  // are redirected here and cannot access anything else.
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

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold">ResonaBed</p>
              <p className="text-xs text-muted-foreground truncate">
                {isLoading ? "…" : (data?.org?.name ?? "No organisation")}
              </p>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.to;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link to={item.to} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="flex-1">
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {data?.org?.name ?? "No organisation assigned"}
                  </span>
                  <Badge variant="secondary">{roleLabel}</Badge>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {data?.displayName ?? data?.email}
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
