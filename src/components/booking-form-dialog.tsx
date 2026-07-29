import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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

interface BookingLite {
  id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  practitioner_id: string | null;
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

function toISODate(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function fmtSlot(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
      setDateStr(toISODate(start));
      setSlotMin(String(start.getHours() * 60 + start.getMinutes()));
      setNotes(booking.notes ?? "");
    } else {
      setClientId("");
      setServiceId("");
      setPractitionerId("");
      const start = defaultStartsAt ? new Date(defaultStartsAt) : new Date();
      setDateStr(toISODate(start));
      setSlotMin("");
      setNotes("");
    }
    setNewClientMode(false);
    setNewFirst("");
    setNewLast("");
    setNewEmail("");
    setNewPhone("");
  }, [open, booking, defaultStartsAt]);

  // Practitioners can only assign themselves — lock the value once we know who they are.
  useEffect(() => {
    if (!open || !selfOnly || !ctx) return;
    if (practitionerId !== ctx.userId) setPractitionerId(ctx.userId);
  }, [open, selfOnly, ctx, practitionerId]);

  // ---------- Compute 30-min slots for chosen practitioner / date / service ----------

  const dayBookingsRange = useMemo(() => {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [dateStr]);

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
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    const windows = availability.filter(
      (a) => a.practitioner_id === practitionerId && a.is_active && a.day_of_week === day,
    );
    if (windows.length === 0) return [];
    const duration = svc.duration_minutes;
    // Existing bookings for this practitioner (excluding the one being edited).
    // Unconfirmed public requests never block a slot — they're only requests.
    const busy = dayBookings
      .filter(
        (b) =>
          b.practitioner_id === practitionerId &&
          b.id !== booking?.id &&
          !((b as { source?: string }).source === "public" && b.status === "pending"),
      )
      .map((b) => {
        const s = new Date(b.starts_at);
        const e = new Date(b.ends_at);
        const buf = (b.service?.buffer_minutes ?? 0) * 60_000;
        return {
          start: s.getHours() * 60 + s.getMinutes(),
          end: e.getHours() * 60 + e.getMinutes() + Math.round(buf / 60_000),
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
  }, [practitionerId, dateStr, availability, svc, dayBookings, booking?.id]);

  // If the currently-selected slot is no longer valid, clear it.
  useEffect(() => {
    if (!slotMin) return;
    if (!slots.includes(Number(slotMin))) {
      // Keep the slot if we're editing this booking's original time — availability may not include it.
      if (booking) {
        const start = new Date(booking.starts_at);
        const orig = start.getHours() * 60 + start.getMinutes();
        if (orig === Number(slotMin) && practitionerId === booking.practitioner_id) return;
      }
      setSlotMin("");
    }
  }, [slots, slotMin, booking, practitionerId]);

  const startsIso = useMemo(() => {
    if (!dateStr || !slotMin) return "";
    const [y, mo, d] = dateStr.split("-").map(Number);
    const min = Number(slotMin);
    const dt = new Date(y, mo - 1, d, Math.floor(min / 60), min % 60, 0, 0);
    return dt.toISOString();
  }, [dateStr, slotMin]);

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
                    {p.display_name ?? p.id.slice(0, 8)}
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
                      {fmtSlot(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {endsIso && (
            <p className="text-xs text-muted-foreground">
              Ends at{" "}
              {new Date(endsIso).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
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
