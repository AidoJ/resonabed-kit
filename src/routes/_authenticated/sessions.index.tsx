import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { listMyOrgSessions } from "@/lib/sessions.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/sessions/")({
  head: () => ({ meta: [{ title: "Sessions — ResonaBed" }] }),
  component: SessionsIndex,
});

function statusColor(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (s === "cancelled") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

function SessionsIndex() {
  const fn = useServerFn(listMyOrgSessions);
  const { data, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">Most recent first.</p>
        </div>
        <Button asChild size="lg" className="h-12">
          <Link to="/sessions/new"><Plus className="mr-2 h-4 w-4" /> New session</Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No sessions yet. Start one with the New session button.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((row) => {
              const client = row.client as { first_name: string; last_name: string } | null;
              const service = row.service as { name: string } | null;
              const freq = row.frequency as { hz: number; name: string; color: string | null } | null;
              const target =
                row.status === "draft"
                  ? { to: "/sessions/$id/play", params: { id: row.id } }
                  : { to: "/sessions/$id", params: { id: row.id } };
              return (
                <li key={row.id}>
                  <Link
                    {...target}
                    className="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-muted/40 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] md:items-center"
                  >
                    <span className="font-medium">
                      {client ? `${client.first_name} ${client.last_name}` : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">{service?.name ?? "—"}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {freq ? (
                        <>
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: freq.color ?? "#888" }}
                          />
                          {freq.hz} Hz · {freq.name}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <Badge className={statusColor(row.status)} variant="secondary">
                      {row.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{row.payment_method}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(row.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
