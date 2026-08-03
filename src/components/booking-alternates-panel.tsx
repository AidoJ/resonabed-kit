/**
 * Operator-side "propose alternate times".
 *
 * Returning clients get an emailed, single-use link. First-timers are handled
 * on the vetting call, so the operator reads the times out and accepts on
 * their behalf. Nothing is held or confirmed until a slot is taken.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAvailability } from "@/lib/availability.functions";
import {
  listBookingOffers,
  proposeAlternates,
  withdrawOffer,
  acceptAlternateForClient,
} from "@/lib/booking-offers.functions";
import { slotsForDate, isWorkingDate, type AvailabilityWindow } from "@/lib/availability-pattern";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatInTz, tzAbbrev } from "@/lib/timezone";
import { publicShortName } from "@/lib/person-name";

type Row = { date: string; time: string };

const emptyRows: Row[] = [
  { date: "", time: "" },
  { date: "", time: "" },
  { date: "", time: "" },
];

function label12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}

export function BookingAlternatesPanel({
  bookingId,
  practitioners,
  durationMinutes,
  firstTime,
  practitionerId: fixedPractitionerId,
  onSent,
}: {
  bookingId: string;
  practitioners: { id: string; display_name: string | null }[];
  durationMinutes: number;
  firstTime: boolean;
  /** Already chosen upstream, hides the picker when set. */
  practitionerId?: string;
  onSent?: () => void;
}) {
  const tz = useOrgTimezone();
  const listAvail = useServerFn(listAvailability);
  const listOffers = useServerFn(listBookingOffers);
  const propose = useServerFn(proposeAlternates);
  const withdraw = useServerFn(withdrawOffer);
  const acceptForClient = useServerFn(acceptAlternateForClient);

  const [ownPractitionerId, setOwnPractitionerId] = useState("");
  const practitionerId = fixedPractitionerId ?? ownPractitionerId;
  const setPractitionerId = setOwnPractitionerId;
  const [rows, setRows] = useState<Row[]>(emptyRows);
  // Emailing a booking link is the default. Phone handling is an opt-in,
  // even for first-timers, so the primary button always says "send".
  const [verbal, setVerbal] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);


  const { data: availability = [] } = useQuery({
    queryKey: ["availability", practitionerId],
    queryFn: () => listAvail({ data: practitionerId ? { practitioner_id: practitionerId } : {} }),
    enabled: !!practitionerId,
  });

  const {
    data: offers = [],
    refetch: refetchOffers,
  } = useQuery({
    queryKey: ["booking-offers", bookingId],
    queryFn: () => listOffers({ data: { booking_id: bookingId } }),
  });

  const pattern = useMemo<AvailabilityWindow[]>(
    () =>
      (availability as { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[])
        .filter((a) => a.is_active)
        .map((a) => ({
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
        })),
    [availability],
  );

  const today = new Date().toISOString().slice(0, 10);
  const filled = rows.filter((r) => r.date && r.time);
  const openOffer = (offers as { status: string }[]).find((o) => o.status === "open");

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const send = async () => {
    if (!practitionerId) return toast.error("Choose which practitioner these times are for.");
    if (filled.length < 2) return toast.error("Offer at least two times.");
    setBusy(true);
    try {
      const res = await propose({
        data: {
          booking_id: bookingId,
          practitioner_id: practitionerId,
          slots: filled,
          verbal_only: verbal,
          note: note.trim() || null,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.verbal
          ? "Times saved, read them out on the call, then mark the one they pick."
          : res.emailed
            ? "Times emailed to the client."
            : "Times saved, but the email couldn't be sent, call them instead.",
      );
      setRows(emptyRows);
      setNote("");
      await refetchOffers();
      // Phone handling keeps the panel open: the operator still has to mark
      // which time the client picked on the call.
      if (!verbal) onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send those times.");
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async (offerId: string) => {
    setBusy(true);
    try {
      const res = await withdraw({ data: { offer_id: offerId } });
      if (!res.ok) toast.error(res.error);
      else toast.success("Offer withdrawn, the link no longer works.");
      await refetchOffers();
    } finally {
      setBusy(false);
    }
  };

  const doAccept = async (offerId: string, slotId: string) => {
    setBusy(true);
    try {
      const res = await acceptForClient({ data: { offer_id: offerId, slot_id: slotId } });
      if (!(res as { ok: boolean }).ok) {
        toast.error((res as { error?: string }).error ?? "Couldn't book that time.");
        return;
      }
      toast.success("Booked, the client has been emailed their confirmation.");
      await refetchOffers();
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't book that time.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Offer two or three times that suit you. The request stays pending and nothing is held
          until one is taken. {firstTime ? "For a first-time client we recommend reading the times out on your call." : "The client gets a single-use link that expires in 24 hours."}
        </p>
      </div>

      {/* ---------------- live offer ---------------- */}
      {openOffer ? (
        <div className="grid gap-2 rounded-md border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Times already offered</p>
            <Badge variant="secondary">Awaiting the client</Badge>
          </div>
          {(
            openOffer as unknown as {
              id: string;
              expires_at: string;
              slots: { id: string; starts_at: string }[];
            }
          ).slots.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span>
                {formatInTz(s.starts_at, tz, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                ({tzAbbrev(tz)})
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void doAccept((openOffer as unknown as { id: string }).id, s.id)
                }
              >
                They chose this
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Expires{" "}
            {formatInTz((openOffer as unknown as { expires_at: string }).expires_at, tz, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="justify-self-start"
            disabled={busy}
            onClick={() => void doWithdraw((openOffer as unknown as { id: string }).id)}
          >
            <X className="mr-2 h-4 w-4" /> Withdraw these times
          </Button>
        </div>
      ) : null}

      {/* ---------------- new offer ---------------- */}
      {fixedPractitionerId ? null : (
        <div className="grid gap-2">
          <Label htmlFor="alt-prac">Practitioner these times are for</Label>
          <Select value={practitionerId} onValueChange={setPractitionerId}>
            <SelectTrigger id="alt-prac">
              <SelectValue placeholder="Choose a practitioner" />
            </SelectTrigger>
            <SelectContent>
              {practitioners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {publicShortName(p.display_name) || p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}


      {rows.map((row, i) => {
        const times = row.date ? slotsForDate(pattern, row.date, durationMinutes) : [];
        const notWorking = !!row.date && !isWorkingDate(pattern, row.date);
        return (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={`alt-date-${i}`} className="text-xs">
                Option {i + 1} {i === 2 ? "(optional)" : ""}
              </Label>
              <Input
                id={`alt-date-${i}`}
                type="date"
                min={today}
                value={row.date}
                disabled={!practitionerId}
                onChange={(e) => setRow(i, { date: e.target.value, time: "" })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`alt-time-${i}`} className="text-xs">
                Time
              </Label>
              <Select
                value={row.time}
                onValueChange={(v) => setRow(i, { time: v })}
                disabled={!row.date || times.length === 0}
              >
                <SelectTrigger id={`alt-time-${i}`}>
                  <SelectValue
                    placeholder={
                      notWorking
                        ? "Not a working day"
                        : times.length === 0
                          ? "No times fit that day"
                          : "Choose a time"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {times.map((t) => (
                    <SelectItem key={t} value={t}>
                      {label12h(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      })}

      <label className="flex items-start gap-2 text-xs">
        <Checkbox
          checked={verbal}
          onCheckedChange={(v) => setVerbal(v === true)}
          className="mt-0.5"
        />
        <span>
          Handle this by phone, don&rsquo;t email a booking link. Recommended for first-time
          clients: read the times out on your vetting call and mark the one they pick.
        </span>
      </label>

      {verbal ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          No email will be sent. These times are saved for your call only, come back here and press
          &ldquo;They chose this&rdquo; once the client picks one. Untick the box above if you want
          the client emailed a booking link instead.
        </p>
      ) : null}


      {!verbal ? (
        <div className="grid gap-1">
          <Label htmlFor="alt-note" className="text-xs">
            Short note to include in the email (optional)
          </Label>
          <Textarea
            id="alt-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Sorry, that morning is booked, any of these suit?"
            className="bg-card"
          />
        </div>
      ) : null}

      <Button disabled={busy} onClick={() => void send()} className="justify-self-start">
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {verbal ? "Save these times for your call" : "Send proposed times to client"}
      </Button>
    </div>
  );
}
