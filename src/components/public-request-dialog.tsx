import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Phone, UserPlus, Ban, NotebookPen, CalendarClock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { respondToPublicRequest, getPublicRequestDetail } from "@/lib/bookings.functions";
import {
  logBookingViewed,
  addClientNote,
  blockContact,
  logBookingNoteAdded,
} from "@/lib/booking-safety.functions";
import {
  VETTING_CALL_RECOMMENDATION,
  VETTING_SECTIONS,
  VETTING_CLOSING_LINE,
  CLEARABLE_ITEM_GUIDANCE,
  NON_CLEARABLE_ITEM_GUIDANCE,
  DECLINE_REASON_CODES,
  DECLINE_REASON_LABELS,
  type DeclineReasonCode,
} from "@/lib/vetting-guide";
import { BookingAlternatesPanel } from "@/components/booking-alternates-panel";
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
  client_id?: string | null;
  is_first_time?: boolean;
  client?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  public_note?: string | null;
  service?: { name: string; duration_minutes?: number } | null;
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
  const logViewed = useServerFn(logBookingViewed);
  const saveNote = useServerFn(addClientNote);
  const block = useServerFn(blockContact);
  const logNote = useServerFn(logBookingNoteAdded);
  const tz = useOrgTimezone();
  const [practitionerId, setPractitionerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [mode, setMode] = useState<"review" | "schedule" | "decline" | "alternates">("review");
  const [reasonCode, setReasonCode] = useState<DeclineReasonCode>("unable_to_accommodate");
  const [notifyClient, setNotifyClient] = useState(true);
  const [alsoBlock, setAlsoBlock] = useState(false);

  const bookingId = booking?.id ?? null;

  useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setAcknowledged(false);
      setMode("review");
      setCallNote("");
      setAlsoBlock(false);
      setShowGuide(false);
      return;
    }
    let cancelled = false;
    void loadDetail({ data: { id: bookingId } })
      .then((d) => {
        if (!cancelled) {
          const detailData = d as unknown as RequestDetail;
          setDetail(detailData);
          setShowGuide(detailData.is_first_time === true);
        }
      })
      .catch(() => {
        /* details are advisory; confirm still works */
      });
    // Append-only: records that this request was opened for review.
    void logViewed({ data: { booking_id: bookingId } }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, loadDetail, logViewed]);

  if (!booking) return null;

  const homeBased = detail?.clinic_type === "home";
  const client = detail?.client ?? booking.client ?? null;
  const note = detail?.public_note ?? booking.public_note ?? null;
  const firstTime = detail?.is_first_time === true;

  /** Anything learned on the call goes to protected notes, never the trail. */
  const persistCallNote = async () => {
    const body = callNote.trim();
    if (!body || !detail?.client_id) return;
    try {
      await saveNote({
        data: { client_id: detail.client_id, body, kind: "vetting_call" as const },
      });
      // History records that a note exists, never what it says.
      await logNote({ data: { booking_id: booking!.id } }).catch(() => {});
    } catch {
      toast.error("Your call notes couldn't be saved, copy them before closing.");
    }
  };

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
      await persistCallNote();
      await respond({
        data: {
          id: booking.id,
          action,
          practitioner_id: action === "confirm" ? practitionerId : undefined,
          reason_code: action === "decline" ? reasonCode : undefined,
          notify_client: action === "decline" ? notifyClient : false,
        },
      });
      if (action === "decline" && alsoBlock) {
        await block({
          data: {
            display_name: client ? `${client.first_name} ${client.last_name}` : null,
            email: detail?.client?.email ?? null,
            phone: detail?.client?.phone ?? null,
            reason: DECLINE_REASON_LABELS[reasonCode],
            booking_id: booking.id,
          },
        }).catch(() => toast.error("Declined, but the block couldn't be saved."));
      }
      toast.success(
        action === "confirm"
          ? "Booking confirmed, the client has been emailed the details and your address."
          : notifyClient
            ? "Request declined and the client has been notified."
            : "Request declined.",
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
            Submitted through your public page. Nothing is scheduled, and no address is shared,
            until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Requested</p>
            <p className="font-medium">{when}</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Who is asking</p>
              {detail ? (
                <Badge variant={firstTime ? "default" : "secondary"} className="text-[11px]">
                  {firstTime ? "First-time client" : "Returning client"}
                </Badge>
              ) : null}
            </div>
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

          {mode === "review" ? (
          <>
          {/* ---------------- first-time vetting call guide ---------------- */}
          {firstTime ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="space-y-2">
                  <p className="font-medium">We recommend a quick call first</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {VETTING_CALL_RECOMMENDATION}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGuide((v) => !v)}
                  >
                    {showGuide ? "Hide question guide" : "Show question guide"}
                  </Button>
                </div>
              </div>

              {showGuide ? (
                <div className="mt-3 space-y-3 border-t pt-3">
                  {VETTING_SECTIONS.map((section) => (
                    <div key={section.heading}>
                      <p className="text-xs font-semibold">{section.heading}</p>
                      {section.subheading ? (
                        <p className="text-[11px] text-muted-foreground">{section.subheading}</p>
                      ) : null}
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                        {section.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {VETTING_CLOSING_LINE}
                  </p>
                  <Separator />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold">If a clearable item comes up: </span>
                    {CLEARABLE_ITEM_GUIDANCE}
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold">If pregnancy comes up: </span>
                    {NON_CLEARABLE_ITEM_GUIDANCE}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* -------- review notes: always visible, always saved -------- */}
          <div className="grid gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-background p-3">
            <Label htmlFor="pr-note" className="flex items-center gap-2 text-sm font-semibold">
              <NotebookPen className="h-4 w-4 text-primary" />
              Review notes (private to your clinic)
            </Label>
            <Textarea
              id="pr-note"
              rows={4}
              maxLength={4000}
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="Type here, e.g. what was said on the call, why you're confirming or declining."
              className="bg-card"
            />
            <p className="text-[11px] text-muted-foreground">
              Saved to the client&rsquo;s protected notes when you confirm or decline. The booking
              history records only that a note was added, never its contents.
            </p>
          </div>
          </>
          ) : null}

          {mode === "schedule" ? (
            <>
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
                      Your studio is home-based, so your street address is not on your public page.
                      It is emailed to this person the moment you confirm. Take a moment to check
                      the request looks genuine.
                    </p>
                    <label className="flex items-start gap-2 text-xs font-medium">
                      <Checkbox
                        checked={acknowledged}
                        onCheckedChange={(v) => setAcknowledged(v === true)}
                        className="mt-0.5"
                      />
                      <span>
                        I&rsquo;ve read this request and I&rsquo;m happy to share my address.
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Confirming emails this person their appointment details, including your clinic
                  address.
                </p>
              )}
            </>
          ) : mode === "alternates" ? (
            <BookingAlternatesPanel
              bookingId={booking.id}
              practitioners={practitioners}
              durationMinutes={
                detail?.service?.duration_minutes ??
                Math.max(
                  30,
                  Math.round(
                    (new Date(booking.ends_at).getTime() -
                      new Date(booking.starts_at).getTime()) /
                      60000,
                  ),
                )
              }
              firstTime={firstTime}
              onSent={onDone}
            />
          ) : (
            /* ------------------------- decline flow ------------------------- */
            <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">

              <div className="grid gap-2">
                <Label htmlFor="pr-reason">Why are you declining?</Label>
                <Select
                  value={reasonCode}
                  onValueChange={(v) => setReasonCode(v as DeclineReasonCode)}
                >
                  <SelectTrigger id="pr-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECLINE_REASON_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {DECLINE_REASON_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Recorded on the booking&rsquo;s audit trail as a reason code only. The client is
                  never told the reason, and no health detail is stored here.
                </p>
              </div>

              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={notifyClient}
                  onCheckedChange={(v) => setNotifyClient(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Email them a short, neutral note that you can&rsquo;t take this booking, with your
                  contact details if they want to talk.
                </span>
              </label>

              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={alsoBlock}
                  onCheckedChange={(v) => setAlsoBlock(v === true)}
                  className="mt-0.5"
                />
                <span className="flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5 shrink-0" />
                  Also block this person from booking online again.
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "review" ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setMode("decline")}>
                Decline request
              </Button>
              <Button disabled={busy} onClick={() => setMode("schedule")}>
                Accept request, choose a time
              </Button>
            </>
          ) : mode === "schedule" ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => setMode("review")}>
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!practitionerId) {
                      toast.error("Choose a practitioner first.");
                      return;
                    }
                    setMode("alternates");
                  }}
                >
                  <CalendarClock className="mr-2 h-4 w-4" /> Propose other times
                </Button>
                <Button disabled={busy} onClick={() => void run("confirm")}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Confirm requested time
                </Button>
              </div>
            </>
          ) : mode === "alternates" ? (
            <Button variant="ghost" disabled={busy} onClick={() => setMode("schedule")}>
              Back
            </Button>
          ) : (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => setMode("review")}>
                Back
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => void run("decline")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Decline request
              </Button>
            </>
          )}
        </DialogFooter>


      </DialogContent>
    </Dialog>
  );
}
