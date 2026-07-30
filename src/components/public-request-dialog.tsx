import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { respondToPublicRequest, getPublicRequestDetail } from "@/lib/bookings.functions";
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

type RequestDetail = {
  clinic_type: "retail" | "home";
  client?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  public_note?: string | null;
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
  const loadDetail = useServerFn(getPublicRequestDetail);
  const tz = useOrgTimezone();
  const [practitionerId, setPractitionerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const bookingId = booking?.id ?? null;

  useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setAcknowledged(false);
      return;
    }
    let cancelled = false;
    void loadDetail({ data: { id: bookingId } })
      .then((d) => {
        if (!cancelled) setDetail(d as unknown as RequestDetail);
      })
      .catch(() => {
        /* details are advisory; confirm still works */
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, loadDetail]);

  if (!booking) return null;

  const homeBased = detail?.clinic_type === "home";
  const client = detail?.client ?? booking.client ?? null;
  const note = detail?.public_note ?? booking.public_note ?? null;

  const run = async (action: "confirm" | "decline") => {
    if (action === "confirm" && !practitionerId) {
      toast.error("Choose a practitioner to confirm this request.");
      return;
    }
    if (action === "confirm" && homeBased && !acknowledged) {
      toast.error("Confirm you're happy to share your address with this person.");
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
      toast.success(
        action === "confirm"
          ? "Booking confirmed — the client has been emailed the details and your address."
          : "Request declined",
      );
      onOpenChange(false);
      setPractitionerId("");
      setAcknowledged(false);
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
            Submitted through your public page. Nothing is scheduled — and no address is shared —
            until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Requested</p>
            <p className="font-medium">{when}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Who is asking</p>
            <p className="font-medium">
              {client?.first_name} {client?.last_name}
            </p>
            {detail?.client?.email ? (
              <p className="text-muted-foreground">{detail.client.email}</p>
            ) : null}
            {detail?.client?.phone ? (
              <p className="text-muted-foreground">{detail.client.phone}</p>
            ) : (
              <p className="text-muted-foreground">No phone number given</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Session</p>
            <p className="font-medium">{detail?.service?.name ?? booking.service?.name}</p>
          </div>
          {note ? (
            <div>
              <p className="text-muted-foreground">Their note</p>
              <p className="whitespace-pre-line rounded-md bg-muted/50 p-3">{note}</p>
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

          {homeBased ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Confirming shares your address with this person.</p>
                <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/80">
                  Your studio is home-based, so your street address is not on your public page. It
                  is emailed to this person the moment you confirm. Take a moment to check the
                  request looks genuine.
                </p>
                <label className="flex items-start gap-2 text-xs font-medium">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                    className="mt-0.5"
                  />
                  <span>I&rsquo;ve read this request and I&rsquo;m happy to share my address.</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Confirming emails this person their appointment details, including your clinic
              address.
            </p>
          )}
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
