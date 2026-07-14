import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCurrentUserContext } from "@/lib/user-context.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ResonaBed" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-xl" />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{data?.displayName ? `, ${data.displayName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Vibroacoustic therapy session workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{data?.org?.name ?? "Not assigned"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Your roles</span>
            <div className="flex gap-1">
              {data?.roles.length ? (
                data.roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r.replace("_", " ")}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline">None</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!data?.org && !data?.roles.includes("super_admin") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waiting on setup</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your account isn't linked to an organisation yet. A super admin needs to assign you
            before you can access clients and sessions.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
