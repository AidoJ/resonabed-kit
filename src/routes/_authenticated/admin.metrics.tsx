import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformMetrics } from "@/lib/platform-metrics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/metrics")({
  head: () => ({
    meta: [
      { title: "Platform metrics, ResonaBed" },
      { name: "description", content: "Platform metrics: organisations, sessions and revenue across Resonabed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformMetricsPage,
});

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function PlatformMetricsPage() {
  const fetchMetrics = useServerFn(getPlatformMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-metrics"],
    queryFn: () => fetchMetrics(),
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Aggregate, non-identifiable data only. Individual clients, bookings and session records
        are never shown here, use <strong>Access for support</strong> on an organisation for
        one-off, logged access.
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Organisations" value={data.orgs.total} sub={`${data.orgs.active} active · ${data.orgs.suspended} suspended`} />
        <StatCard label="Configured" value={data.orgs.configured} sub={`${data.orgs.unconfigured} pending setup`} />
        <StatCard label="Sessions (30d)" value={data.totals.sessions_30d} sub={`${data.totals.sessions_total} lifetime`} />
        <StatCard label="Revenue" value={fmtMoney(data.totals.revenue_total)} sub="Completed & paid, lifetime" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Licences · trial" value={data.licences.trial} />
        <StatCard label="Licences · active" value={data.licences.active} />
        <StatCard label="Licences · expired" value={data.licences.expired} />
        <StatCard label="Expiring < 30d" value={data.licences.expiring_30d} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Home (personal kit) users
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Home users"
            value={data.home.users_total}
            sub={`${data.home.users_30d} joined in the last 30 days`}
          />
          <StatCard
            label="Safety signed"
            value={data.home.signed_safety}
            sub={`${Math.max(0, data.home.users_total - data.home.signed_safety)} yet to sign`}
          />
          <StatCard
            label="Access codes"
            value={data.home.codes_total}
            sub={`${data.home.codes_30d} issued in the last 30 days`}
          />
          <StatCard
            label="Codes redeemed"
            value={data.home.codes_redeemed}
            sub={`${data.home.codes_issued} unused · ${data.home.codes_revoked} revoked`}
          />
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Per-organisation activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead className="text-right">Sessions 30d</TableHead>
                <TableHead className="text-right">Sessions total</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Licence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.perOrg.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No organisations yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.perOrg.map((o) => (
                  <TableRow key={o.org_id}>
                    <TableCell className="font-medium">{o.org_name}</TableCell>
                    <TableCell className="text-right">{o.session_count_30d}</TableCell>
                    <TableCell className="text-right">{o.session_count_total}</TableCell>
                    <TableCell className="text-right">{fmtMoney(o.revenue_total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          o.licence_status === "expired"
                            ? "destructive"
                            : o.licence_status === "trial"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {o.licence_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
