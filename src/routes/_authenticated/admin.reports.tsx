import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getReports } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Admin — ResonaBed" }] }),
  component: ReportsAdmin,
});

function toIsoDay(d: Date, endOfDay = false) {
  const c = new Date(d);
  if (endOfDay) c.setHours(23, 59, 59, 999);
  else c.setHours(0, 0, 0, 0);
  return c.toISOString();
}

function ReportsAdmin() {
  const fetchReports = useServerFn(getReports);
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", from, to],
    queryFn: () =>
      fetchReports({
        data: {
          from: toIsoDay(new Date(from)),
          to: toIsoDay(new Date(to), true),
        },
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !data ? null : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Total sessions: <strong>{data.totalSessions}</strong></p>
              <p>
                Unpaid completed sessions:{" "}
                <Badge variant={data.unpaidCompleted > 0 ? "destructive" : "secondary"}>
                  {data.unpaidCompleted}
                </Badge>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Revenue by payment method</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {data.revenueByMethod.length === 0 ? (
                    <TableRow><TableCell className="text-muted-foreground">No revenue.</TableCell></TableRow>
                  ) : (
                    data.revenueByMethod.map((r) => (
                      <TableRow key={r.method}>
                        <TableCell>{r.method}</TableCell>
                        <TableCell className="text-right">{r.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Sessions per week</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Week</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byWeek.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.key}</TableCell>
                      <TableCell>{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Sessions per month</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byMonth.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.key}</TableCell>
                      <TableCell>{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Most-used frequencies</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Frequency</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.topFrequencies.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>{f.hz} Hz {f.label && `— ${f.label}`}</TableCell>
                      <TableCell>{f.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
