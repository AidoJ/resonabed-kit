import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { listBookings, listOrgPractitioners, type BookingStatus } from "@/lib/bookings.functions";
import { BookingFormDialog } from "@/components/booking-form-dialog";

const searchSchema = z.object({
  view: fallback(z.enum(["day", "week"]), "day").default("day"),
  date: fallback(z.string(), "").default(""),
  practitioner: fallback(z.string(), "").default(""),
  filter: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "Bookings — ResonaBed" }] }),
  validateSearch: zodValidator(searchSchema),
  component: BookingsPage,
});

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-muted text-foreground",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground line-through",
  no_show: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function BookingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/bookings" });
  const queryClient = useQueryClient();
  const listFn = useServerFn(listBookings);
  const listPracs = useServerFn(listOrgPractitioners);

  const view = search.view;
  const anchorDate = useMemo(() => {
    return search.date ? new Date(`${search.date}T00:00:00`) : startOfDay(new Date());
  }, [search.date]);

  const { from, to } = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchorDate);
      return { from: start, to: addDays(start, 7) };
    }
    return { from: startOfDay(anchorDate), to: addDays(anchorDate, 1) };
  }, [view, anchorDate]);

  const unpaidOnly = search.filter === "unpaid";
  const practitionerId = search.practitioner || undefined;

  const { data: bookings = [], refetch, isLoading } = useQuery({
    queryKey: [
      "bookings",
      view,
      from.toISOString(),
      to.toISOString(),
      practitionerId ?? "",
      unpaidOnly ? "unpaid" : "",
    ],
    queryFn: () =>
      listFn({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          practitioner_id: practitionerId,
          unpaid_only: unpaidOnly,
        },
      }),
  });

  const { data: practitioners = [] } = useQuery({
    queryKey: ["org-practitioners"],
    queryFn: () => listPracs(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const key = toISODate(new Date(b.starts_at));
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings]);

  const days = useMemo(() => {
    const n = view === "week" ? 7 : 1;
    return Array.from({ length: n }, (_, i) => addDays(from, i));
  }, [view, from]);

  const shift = (delta: number) => {
    const step = view === "week" ? 7 : 1;
    const next = addDays(anchorDate, delta * step);
    setSearch({ date: toISODate(next) });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            {view === "week" ? "Week of " : ""}
            {fmtDate(from)}
            {view === "week" ? ` — ${fmtDate(addDays(from, 6))}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} className="h-10 w-10">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSearch({ date: toISODate(startOfDay(new Date())) })}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} className="h-10 w-10">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={view} onValueChange={(v) => setSearch({ view: v as "day" | "week" })}>
            <SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={practitionerId ?? "__all"}
            onValueChange={(v) => setSearch({ practitioner: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="h-10 w-52"><SelectValue placeholder="All practitioners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All practitioners</SelectItem>
              {practitioners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name ?? p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={unpaidOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setSearch({ filter: unpaidOnly ? "" : "unpaid" })}
          >
            Unpaid only
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="h-10">
            <CalendarPlus className="mr-2 h-4 w-4" /> New booking
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No bookings in this range.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const key = toISODate(day);
            const rows = grouped.get(key) ?? [];
            if (view === "day" || rows.length > 0) {
              return (
                <div key={key}>
                  <h2 className="mb-2 text-sm font-medium text-muted-foreground">{fmtDate(day)}</h2>
                  {rows.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Nothing scheduled.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border bg-card">
                      {rows.map((b) => {
                        const status = b.status as BookingStatus;
                        const session = (b as unknown as {
                          session?: { status?: string; payment_method?: string };
                        }).session;
                        const unpaid =
                          session?.status === "completed" && session.payment_method === "none";
                        return (
                          <li key={b.id}>
                            <Link
                              to="/bookings/$id"
                              params={{ id: b.id }}
                              className="flex items-center gap-4 p-4 hover:bg-muted/40"
                            >
                              <div className="w-24 shrink-0 tabular-nums">
                                <p className="text-sm font-semibold">{fmtTime(b.starts_at)}</p>
                                <p className="text-xs text-muted-foreground">{fmtTime(b.ends_at)}</p>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {b.client?.first_name} {b.client?.last_name}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {b.service?.name} · {b.practitioner?.display_name ?? "—"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {unpaid && (
                                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                                    Unpaid
                                  </Badge>
                                )}
                                <Badge className={STATUS_STYLES[status]}>{status.replace("_", " ")}</Badge>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      <BookingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultStartsAt={from.toISOString()}
        onSaved={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        }}
      />
    </div>
  );
}
