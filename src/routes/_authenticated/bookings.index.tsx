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
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import {
  addDaysToDate,
  dayStartUtc,
  formatDateLabel,
  formatInTz,
  isoDateInTz,
  startOfWeekDate,
  todayInTz,
  tzAbbrev,
} from "@/lib/timezone";
import { BookingFormDialog } from "@/components/booking-form-dialog";
import {
  PublicRequestDialog,
  type PublicRequestSummary,
} from "@/components/public-request-dialog";

const searchSchema = z.object({
  view: fallback(z.enum(["all", "day", "week"]), "all").default("all"),
  date: fallback(z.string(), "").default(""),
  practitioner: fallback(z.string(), "").default(""),
  filter: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "Bookings, ResonaBed" },
      { name: "description", content: "Your clinic's booking calendar: view, confirm and manage client appointments." },
      { name: "robots", content: "noindex" },
    ],
  }),
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


function BookingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/bookings/" });
  const queryClient = useQueryClient();
  const listFn = useServerFn(listBookings);
  const listPracs = useServerFn(listOrgPractitioners);

  // All dates below are plain "YYYY-MM-DD" calendar days in the ORG timezone.
  // Instants are converted to/from UTC only at the boundary (dayStartUtc /
  // formatInTz), so a value already stored as UTC is never shifted twice.
  const tz = useOrgTimezone();
  const fmtTime = (iso: string) => formatInTz(iso, tz);

  const view = search.view;
  const anchor = search.date || todayInTz(tz);

  const { fromDate, toDate } = useMemo(() => {
    if (view === "all") {
      // Everything on file, past and future, grouped by day below.
      return { fromDate: "1970-01-01", toDate: "2100-01-01" };
    }
    if (view === "week") {
      const start = startOfWeekDate(anchor);
      return { fromDate: start, toDate: addDaysToDate(start, 7) };
    }
    return { fromDate: anchor, toDate: addDaysToDate(anchor, 1) };
  }, [view, anchor]);

  const from = useMemo(() => dayStartUtc(fromDate, tz), [fromDate, tz]);
  const to = useMemo(() => dayStartUtc(toDate, tz), [toDate, tz]);

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
  const [requestBooking, setRequestBooking] = useState<PublicRequestSummary | null>(null);

  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => fetchCtx() });
  const canManageBookings = ctx?.permissions?.manageBookings ?? true;

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const key = isoDateInTz(b.starts_at, tz);
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings, tz]);

  const days = useMemo(() => {
    if (view === "all") return Array.from(grouped.keys()).sort();
    const n = view === "week" ? 7 : 1;
    return Array.from({ length: n }, (_, i) => addDaysToDate(fromDate, i));
  }, [view, fromDate, grouped]);

  const shift = (delta: number) => {
    const step = view === "week" ? 7 : 1;
    setSearch({ date: addDaysToDate(anchor, delta * step) });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            {view === "all"
              ? `All bookings (${bookings.length})`
              : `${view === "week" ? "Week of " : ""}${formatDateLabel(fromDate)}${
                  view === "week" ? `, ${formatDateLabel(addDaysToDate(fromDate, 6))}` : ""
                }`}
            <span className="ml-2 text-xs">· times in {tzAbbrev(tz)} ({tz})</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== "all" && (
          <div className="flex items-center rounded-md border">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} className="h-10 w-10">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSearch({ date: todayInTz(tz) })}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} className="h-10 w-10">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          )}
          <Select value={view} onValueChange={(v) => setSearch({ view: v as "all" | "day" | "week" })}>
            <SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
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
          {canManageBookings && (
            <Button onClick={() => setDialogOpen(true)} className="h-10">
              <CalendarPlus className="mr-2 h-4 w-4" /> New booking
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {view === "all" ? "No bookings yet." : "No bookings in this range."}
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const key = day;
            const rows = grouped.get(key) ?? [];
            if (view === "day" || rows.length > 0) {
              return (
                <div key={key}>
                  <h2 className="mb-2 text-sm font-medium text-muted-foreground">{formatDateLabel(day)}</h2>
                  {rows.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Nothing scheduled.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border bg-card">
                      {rows.map((b) => {
                        const status = b.status as BookingStatus;
                        const isPublicRequest =
                          (b as unknown as { source?: string }).source === "public" &&
                          status === "pending";
                        const session = (b as unknown as {
                          session?: { status?: string; payment_method?: string };
                        }).session;
                        const unpaid =
                          session?.status === "completed" && session.payment_method === "none";
                        const bufferMin = (b.service as unknown as { buffer_minutes?: number } | null)
                          ?.buffer_minutes ?? 0;
                        const bufferEnd = new Date(
                          new Date(b.ends_at).getTime() + bufferMin * 60_000,
                        );
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
                                {isPublicRequest && (
                                  <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                                    Public request
                                  </Badge>
                                )}
                                <Badge className={STATUS_STYLES[status]}>{status.replace("_", " ")}</Badge>
                              </div>
                            </Link>
                            {isPublicRequest && canManageBookings && (
                              <div className="flex items-center justify-between gap-3 border-t bg-violet-500/5 px-4 py-2 text-xs">
                                <span className="text-muted-foreground">
                                  <span className="font-medium text-destructive">
                                    Review required
                                  </span>{" "}
                                  · requested online, not scheduled until confirmed
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setRequestBooking(b as unknown as PublicRequestSummary)
                                  }
                                >
                                  Review
                                </Button>
                              </div>
                            )}
                            {bufferMin > 0 && (
                              <div
                                aria-label={`${bufferMin} minute changeover, not bookable`}
                                className="flex items-center gap-4 border-t border-dashed bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
                              >
                                <div className="w-24 shrink-0 tabular-nums opacity-70">
                                  {fmtTime(b.ends_at)}
                                  <span className="mx-1">–</span>
                                  {fmtTime(bufferEnd.toISOString())}
                                </div>
                                <div className="italic">
                                  Changeover · {bufferMin} min · not bookable
                                </div>
                              </div>
                            )}
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

      <PublicRequestDialog
        open={requestBooking !== null}
        onOpenChange={(v) => !v && setRequestBooking(null)}
        booking={requestBooking}
        practitioners={practitioners}
        onDone={() => {
          setRequestBooking(null);
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
          void refetch();
        }}
      />

      <BookingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultStartsAt={from.toISOString()}
        onSaved={(savedStartsAt) => {
          if (savedStartsAt) {
            setSearch({ date: isoDateInTz(savedStartsAt, tz) });
          }
          refetch();
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        }}
      />
    </div>
  );
}
