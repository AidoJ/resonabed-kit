import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pencil, Trash2 } from "lucide-react";
import {
  getBooking,
  updateBookingStatus,
  deleteBooking,
  type BookingStatus,
} from "@/lib/bookings.functions";
import { BookingFormDialog } from "@/components/booking-form-dialog";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatInTz, tzAbbrev } from "@/lib/timezone";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({ meta: [{ title: "Booking — ResonaBed" }] }),
  component: BookingDetail,
});

const STATUS_OPTIONS: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

function BookingDetail() {
  const { id } = Route.useParams();
  const tz = useOrgTimezone();
  const navigate = useNavigate();
  const getFn = useServerFn(getBooking);
  const setStatusFn = useServerFn(updateBookingStatus);
  const deleteFn = useServerFn(deleteBooking);

  const { data: booking, refetch, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!booking) return <p>Not found.</p>;

  const session = (booking as unknown as {
    session?: {
      id: string;
      status: string;
      payment_method: string;
      payment_amount: number | null;
    };
  }).session;
  const status = booking.status as BookingStatus;
  const canStart = status === "pending" || status === "confirmed";
  const unpaid = session?.status === "completed" && session.payment_method === "none";

  const setStatus = async (next: BookingStatus) => {
    setBusy(true);
    try {
      const res = await setStatusFn({ data: { id, status: next } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Booking ${next.replace("_", " ")}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this booking? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      toast.success("Booking deleted");
      navigate({ to: "/bookings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  };

  const startSession = () => {
    navigate({
      to: "/sessions/new",
      search: { booking_id: id },
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {booking.client?.first_name} {booking.client?.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {booking.service?.name} · {booking.service?.duration_minutes} min
            </p>
            <p className="mt-1 text-sm">
              {formatInTz(booking.starts_at, tz, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              – {formatInTz(booking.ends_at, tz)} ({tzAbbrev(tz)})
            </p>
            <p className="text-sm text-muted-foreground">
              Practitioner: {(booking as unknown as { practitioner?: { display_name?: string } }).practitioner?.display_name ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unpaid && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Unpaid
              </Badge>
            )}
            <Badge>{status.replace("_", " ")}</Badge>
          </div>
        </div>

        {booking.notes && (
          <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Notes</p>
            <p>{booking.notes}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {canStart && (
            <Button size="lg" className="h-12" onClick={startSession}>
              <Play className="mr-2 h-4 w-4" /> Start session
            </Button>
          )}
          {session && (
            <Button variant="secondary" size="lg" className="h-12" asChild>
              <Link to="/sessions/$id" params={{ id: session.id }}>
                Open session
              </Link>
            </Button>
          )}
          <Button variant="outline" size="lg" className="h-12" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="lg" className="h-12" onClick={remove} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="text-xs uppercase text-muted-foreground self-center">Set status</span>
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === status ? "default" : "outline"}
              disabled={busy || s === status}
              onClick={() => setStatus(s)}
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>

        {session && (
          <div className="mt-6 rounded-md border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Session</p>
            <p className="text-muted-foreground">
              Status: {session.status}
              {session.payment_method !== "none" && (
                <>
                  {" · "}Paid {session.payment_amount ?? 0} ({session.payment_method})
                </>
              )}
            </p>
          </div>
        )}

        <BookingAuditTrail bookingId={id} />
      </div>

      <BookingFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={booking}
        onSaved={() => refetch()}
      />
    </div>
  );
}
