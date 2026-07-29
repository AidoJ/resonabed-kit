import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { respondToPublicRequest } from "@/lib/bookings.functions";
import { toast } from "sonner";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatInTz, tzAbbrev } from "@/lib/timezone";

export type PublicRequestSummary = {
  id: string;
  starts_at: string;
  ends_at: string;
  public_note?: string | null;
  client?: { first_name: string; last_name: string } | null;
  service?: { name: string } | null;
};

export function PublicRequestDialog({
  open,
  onOpenChange,
  booking,
  practitioners,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: PublicRequestSummary | null;
  practitioners: { id: string; display_name: string | null }[];
  onDone: () => void;
}) {
  const respond = useServerFn(respondToPublicRequest);
  const [practitionerId, setPractitionerId] = useState("");
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  const run = async (action: "confirm" | "decline") => {
    if (action === "confirm" && !practitionerId) {
      toast.error("Choose a practitioner to confirm this request.");
      return;
    }
    setBusy(true);
    try {
      await respond({
        data: {
          id: booking.id,
          action,
          practitioner_id: action === "confirm" ? practitionerId : undefined,
        },
      });
      toast.success(action === "confirm" ? "Booking confirmed" : "Request declined");
      onOpenChange(false);
      setPractitionerId("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const when = `${formatInTz(booking.starts_at, tz, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })} (${tzAbbrev(tz)})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Public booking request</DialogTitle>
          <DialogDescription>
            Submitted through your public page. Nothing is scheduled until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Requested</p>
            <p className="font-medium">{when}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">
              {booking.client?.first_name} {booking.client?.last_name}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Session</p>
            <p className="font-medium">{booking.service?.name}</p>
          </div>
          {booking.public_note ? (
            <div>
              <p className="text-muted-foreground">Their note</p>
              <p className="whitespace-pre-line rounded-md bg-muted/50 p-3">
                {booking.public_note}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="pr-prac">Assign practitioner</Label>
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger id="pr-prac">
                <SelectValue placeholder="Choose a practitioner" />
              </SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name ?? p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={busy} onClick={() => run("decline")}>
            Decline
          </Button>
          <Button disabled={busy} onClick={() => run("confirm")}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
