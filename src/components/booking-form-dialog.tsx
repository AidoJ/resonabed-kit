import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { phoneValidationError, PHONE_HELP_TEXT } from "@/lib/phone";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBooking,
  updateBooking,
  listOrgPractitioners,
  listBookings,
} from "@/lib/bookings.functions";
import {
  listMyOrgClients,
  listMyOrgServices,
  createClientRecord,
} from "@/lib/sessions.functions";
import { listAvailability } from "@/lib/availability.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import {
import { publicShortName } from "@/lib/person-name";
  addDaysToDate,
  dayOfWeekOfDate,
  dayStartUtc,
  formatInTz,
  isoDateInTz,
  minutesLabel,
  minutesOfDayInTz,
  todayInTz,
  tzAbbrev,
  zonedWallTimeToUtc,
} from "@/lib/timezone";

interface BookingLite {
  id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  practitioner_id: string | null;
  status?: string;
  source?: string;
  client_id?: string;
  service_id?: string;
  client?: { id: string; first_name: string; last_name: string } | null;
  service?: { id: string; name: string; duration_minutes: number; buffer_minutes?: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking?: BookingLite | null;
  defaultStartsAt?: string;
  onSaved: (savedStartsAt?: string) => void;
}

const SLOT_MINUTES = 30;

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}


export function BookingFormDialog({ open, onOpenChange, booking, defaultStartsAt, onSaved }: Props) {
  const listClients = useServerFn(listMyOrgClients);
  const listServices = useServerFn(listMyOrgServices);
  const listPracs = useServerFn(listOrgPractitioners);
  const listAvail = useServerFn(listAvailability);
  const listBooks = useServerFn(listBookings);
  const createFn = useServerFn(createBooking);
  const updateFn = useServerFn(updateBooking);
  const createClientFn = useServerFn(createClientRecord);
  const ctxFn = useServerFn(getCurrentUserContext);
  // Every wall-clock value in this dialog is interpreted in the ORG timezone.
  const tz = useOrgTimezone();
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  const canAssignAnyone =
    !!ctx && (ctx.roles.includes("super_admin") || ctx.roles.includes("org_admin"));
  const selfOnly = !!ctx && !canAssignAnyone;

  const [clientQuery, setClientQuery] = useState("");
  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ["org-clients", clientQuery],
    queryFn: () => listClients({ data: { search: clientQuery } }),
    enabled: open,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["org-services"],
    queryFn: () => listServices(),
    enabled: open,
  });
  const { data: practitioners = [] } = useQuery({
    queryKey: ["org-practitioners"],
    queryFn: () => listPracs(),
    enabled: open,
  });
  const { data: availability = [] } = useQuery({
    queryKey: ["all-availability"],
    queryFn: () => listAvail({ data: {} }),
    enabled: open,
  });
  const visiblePractitioners = useMemo(
    () => (selfOnly && ctx ? practitioners.filter((p) => p.id === ctx.userId) : practitioners),
    [practitioners, selfOnly, ctx],
  );

  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [practitionerId, setPractitionerId] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>(""); // yyyy-mm-dd
  const [slotMin, setSlotMin] = useState<string>(""); // minutes-from-midnight, as string for Select
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    if (booking) {
      const start = new Date(booking.starts_at);
      setClientId(booking.client_id ?? booking.client?.id ?? "");
      setServiceId(booking.service_id ?? booking.service?.id ?? "");
      setPractitionerId(booking.practitioner_id ?? "");
      setDateStr(isoDateInTz(start, tz));
      setSlotMin(String(minutesOfDayInTz(start, tz)));
      setNotes(booking.notes ?? "");
    } else {
      setClientId("");
      setServiceId("");
      setPractitionerId("");
      setDateStr(defaultStartsAt ? isoDateInTz(defaultStartsAt, tz) : todayInTz(tz));
      setSlotMin("");
      setNotes("");
    }
    setNewClientMode(false);
    setNewFirst("");
    setNewLast("");
    setNewEmail("");
    setNewPhone("");
  }, [open, booking, defaultStartsAt, tz]);

  // Practitioners can only assign themselves, lock the value once we know who they are.
  useEffect(() => {
    if (!open || !selfOnly || !ctx) return;
    if (practitionerId !== ctx.userId) setPractitionerId(ctx.userId);
  }, [open, selfOnly, ctx, practitionerId]);

  // ---------- Compute 30-min slots for chosen practitioner / date / service ----------

  const dayBookingsRange = useMemo(() => {
    if (!dateStr) return null;
    return {
      from: dayStartUtc(dateStr, tz).toISOString(),
      to: dayStartUtc(addDaysToDate(dateStr, 1), tz).toISOString(),
    };
  }, [dateStr, tz]);

  const { data: dayBookings = [] } = useQuery({
    queryKey: ["day-bookings", dayBookingsRange?.from ?? "", dayBookingsRange?.to ?? ""],
    queryFn: () => listBooks({ data: { from: dayBookingsRange!.from, to: dayBookingsRange!.to } }),
    enabled: open && !!dayBookingsRange,
  });

  const svc = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  const slots = useMemo(() => {
    if (!practitionerId || !dateStr || !svc) return [];
    const day = dayOfWeekOfDate(dateStr);
    const windows = availability.filter(
      (a) => a.practitioner_id === practitionerId && a.is_active && a.day_of_week === day,
    );
    if (windows.length === 0) return [];
    const duration = svc.duration_minutes;
    // Existing bookings for this practitioner (excluding the one being edited).
    // Unconfirmed public requests never block a slot, they're only requests.
    const busy = dayBookings
      .filter(
        (b) =>
          b.practitioner_id === practitionerId &&
          b.id !== booking?.id &&
          !(b.source === "public" && b.status === "pending"),
      )
      .map((b) => {
        const buf = b.service?.buffer_minutes ?? 0;
        return {
          start: minutesOfDayInTz(b.starts_at, tz),
          end: minutesOfDayInTz(b.ends_at, tz) + buf,
        };
      });

    const out: number[] = [];
    for (const w of windows) {
      const ws = parseHM(w.start_time);
      const we = parseHM(w.end_time);
      for (let t = Math.ceil(ws / SLOT_MINUTES) * SLOT_MINUTES; t + duration <= we; t += SLOT_MINUTES) {
        const slotEnd = t + duration;
        const conflict = busy.some((b) => t < b.end && slotEnd > b.start);
        if (!conflict) out.push(t);
      }
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }, [practitionerId, dateStr, availability, svc, dayBookings, booking?.id, tz]);

  // If the currently-selected slot is no longer valid, clear it.
  useEffect(() => {
    if (!slotMin) return;
    if (!slots.includes(Number(slotMin))) {
      // Keep the slot if we're editing this booking's original time, availability may not include it.
      if (booking) {
        const orig = minutesOfDayInTz(booking.starts_at, tz);
        if (orig === Number(slotMin) && practitionerId === booking.practitioner_id) return;
      }
      setSlotMin("");
    }
  }, [slots, slotMin, booking, practitionerId, tz]);

  const startsIso = useMemo(() => {
    if (!dateStr || !slotMin) return "";
    const min = Number(slotMin);
    const hhmm = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    // Interpret the entered wall-clock time in the ORG timezone, exactly like
    // the public booking path does. Stored value is true UTC.
    return zonedWallTimeToUtc(dateStr, hhmm, tz).toISOString();
  }, [dateStr, slotMin, tz]);

  const endsIso = useMemo(() => {
    if (!startsIso || !svc) return "";
    return new Date(new Date(startsIso).getTime() + svc.duration_minutes * 60_000).toISOString();
  }, [startsIso, svc]);

  const canAddClient = newFirst.trim().length > 0 && newLast.trim().length > 0;
  const canSave =
    !!(serviceId && practitionerId && dateStr && slotMin && startsIso && endsIso) &&
    !!clientId &&
    !newClientMode;

  const handleAddClient = async () => {
    if (!canAddClient) return;
    if (newPhone.trim()) {
      const badPhone = phoneValidationError(newPhone);
      if (badPhone) {
        toast.error(badPhone);
        return;
      }
    }
    setAddingClient(true);
    try {
      const created = await createClientFn({
        data: {
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
        },
      });
      toast.success("Client added");
      setNewFirst("");
      setNewLast("");
      setNewEmail("");
      setNewPhone("");
      setNewClientMode(false);
      await refetchClients();
      setClientId(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create client");
    } finally {
      setAddingClient(false);
    }
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        service_id: serviceId,
        practitioner_id: practitionerId,
        starts_at: startsIso,
        ends_at: endsIso,
        notes: notes || undefined,
      };
      if (booking) {
        await updateFn({ data: { id: booking.id, patch: payload } });
        toast.success("Booking updated");
      } else {
        await createFn({ data: payload });
        toast.success("Booking created");
      }
      onSaved(payload.starts_at);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const slotPlaceholder = !practitionerId
    ? "Pick a practitioner first"
    : !svc
      ? "Pick a service first"
      : !dateStr
        ? "Pick a date first"
        : slots.length === 0
          ? "No available slots that day"
          : "Choose a time";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking ? "Edit booking" : "New booking"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Client</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNewClientMode((v) => !v)}
              >
                {newClientMode ? "Pick existing" : "+ New client"}
              </Button>
            </div>
            {newClientMode ? (
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} />
                  <Input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} />
                  <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{PHONE_HELP_TEXT}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddClient}
                    disabled={!canAddClient || addingClient}
                  >
                    {addingClient ? "Adding…" : "Add client"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add the client, then continue with their booking.
                </p>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search clients"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                />
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.last_name}, {c.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Practitioner</Label>
            <Select
              value={practitionerId}
              onValueChange={setPractitionerId}
              disabled={selfOnly}
            >
              <SelectTrigger><SelectValue placeholder="Assign a practitioner" /></SelectTrigger>
              <SelectContent>
                {visiblePractitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {publicShortName(p.display_name) || p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selfOnly && (
              <p className="text-xs text-muted-foreground">
                Practitioners can only book sessions for themselves.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Time (30-min slots)</Label>
              <Select
                value={slotMin}
                onValueChange={setSlotMin}
                disabled={slots.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={slotPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {minutesLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {endsIso && (
            <p className="text-xs text-muted-foreground">
              Ends at{" "}
              {formatInTz(endsIso, tz)} ({tzAbbrev(tz)})
              {svc?.buffer_minutes ? ` · ${svc.buffer_minutes}-min changeover after` : ""}
            </p>
          )}

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {newClientMode && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
              Add the new client above before you can save this booking.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave || saving}>
            {saving ? "Saving…" : booking ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
