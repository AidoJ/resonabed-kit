/**
 * Move a confirmed booking to a new time and email the client the new details.
 *
 * Plain "Edit" changes the record silently; this is the path that talks to the
 * client, so it is deliberately separate.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { rescheduleBooking } from "@/lib/bookings.functions";

export function BookingRescheduleDialog({
  open,
  onOpenChange,
  bookingId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  onDone?: () => void;
}) {
  const move = useServerFn(rescheduleBooking);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (!date || !time) return toast.error("Pick a new date and time.");
    setBusy(true);
    try {
      const res = await move({ data: { booking_id: bookingId, date, time, notify } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.emailed
          ? "Booking moved, the client has been emailed the new time."
          : notify
            ? "Booking moved, but the email couldn't be sent, call them instead."
            : "Booking moved, no email was sent.",
      );
      onOpenChange(false);
      setDate("");
      setTime("");
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move that booking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Reschedule booking
          </DialogTitle>
          <DialogDescription>
            The session keeps its length. The client gets an updated confirmation with the new
            time, your contact number and the address.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="rs-date">New date</Label>
            <Input
              id="rs-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="rs-time">New start time</Label>
            <Input
              id="rs-time"
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
              className="mt-0.5"
            />
            <span>Email the client their new appointment details.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Move booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
