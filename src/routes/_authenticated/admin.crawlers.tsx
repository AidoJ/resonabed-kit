import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCrawlerReport } from "@/lib/crawler-report.functions";
import { LOGGED_BOTS } from "@/lib/crawler-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/crawlers")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "AI crawler visits, ResonaBed" },
      { name: "description", content: "Weekly AI crawler visits and most-visited pages per bot." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrawlerVisitsPage,
});

function fmtWeek(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function CrawlerVisitsPage() {
  const fetchReport = useServerFn(getCrawlerReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crawler-report"],
    queryFn: () => fetchReport(),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return <p className="text-sm text-destructive">Couldn't load crawler visits. Please refresh.</p>;
  }

  const weeks = Array.from(new Set(data.weekly.map((r) => r.week_start))).sort().reverse();
  const counts = new Map(data.weekly.map((r) => [`${r.week_start}|${r.bot_name}`, r.visits]));
  const botsWithPaths = LOGGED_BOTS.filter((b) => data.topPaths.some((p) => p.bot_name === b));

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Visits to public pages by AI search and assistant bots (OpenAI, Anthropic, Perplexity).
        Google, Bing and people are never logged. Visits older than 90 days are deleted
        automatically. Weeks start on Monday (Brisbane time).
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visits per bot per week</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week starting</TableHead>
                {LOGGED_BOTS.map((b) => (
                  <TableHead key={b} className="text-right whitespace-nowrap">
                    {b}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={LOGGED_BOTS.length + 2} className="text-muted-foreground">
                    No AI crawler visits recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                weeks.map((w) => {
                  const total = LOGGED_BOTS.reduce((n, b) => n + (counts.get(`${w}|${b}`) ?? 0), 0);
                  return (
                    <TableRow key={w}>
                      <TableCell className="font-medium whitespace-nowrap">{fmtWeek(w)}</TableCell>
                      {LOGGED_BOTS.map((b) => (
                        <TableCell key={b} className="text-right tabular-nums">
                          {counts.get(`${w}|${b}`) ?? 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">{total}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Top 20 pages per bot (last 90 days)</h2>
        {botsWithPaths.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pages visited yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {botsWithPaths.map((bot) => (
              <Card key={bot}>
                <CardHeader>
                  <CardTitle className="text-base">{bot}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Visits</TableHead>
                        <TableHead className="text-right">Last status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topPaths
                        .filter((p) => p.bot_name === bot)
                        .map((p) => (
                          <TableRow key={p.path}>
                            <TableCell className="text-muted-foreground">{p.rank}</TableCell>
                            <TableCell className="break-all font-mono text-xs">{p.path}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.visits}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.last_status}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
