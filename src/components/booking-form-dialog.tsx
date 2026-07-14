import { useEffect, useMemo, useRef, useState } from "react";
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

interface BookingLite {
  id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  practitioner_id: string;
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(s: string): string {
  // Interpret as local time.
  return new Date(s).toISOString();
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

  const [clientQuery, setClientQuery] = useState("");
  const { data: clients = [] } = useQuery({
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

  // Anchor day for fetching neighbouring bookings (for buffer/overlap checks).
  const anchorDayIso = useMemo(() => {
    const src = booking?.starts_at ?? defaultStartsAt ?? new Date().toISOString();
    const d = new Date(src);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [booking, defaultStartsAt]);
  const anchorDayEndIso = useMemo(() => {
    const d = new Date(anchorDayIso);
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }, [anchorDayIso]);
  const { data: dayBookings = [] } = useQuery({
    queryKey: ["day-bookings", anchorDayIso],
    queryFn: () =>
      listBooks({ data: { from: anchorDayIso, to: anchorDayEndIso } }),
    enabled: open,
  });


  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [practitionerId, setPractitionerId] = useState<string>("");
  const [startsLocal, setStartsLocal] = useState<string>("");
  const [endsLocal, setEndsLocal] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    if (booking) {
      setClientId(booking.client_id ?? booking.client?.id ?? "");
      setServiceId(booking.service_id ?? booking.service?.id ?? "");
      setPractitionerId(booking.practitioner_id);
      setStartsLocal(toLocalInput(booking.starts_at));
      setEndsLocal(toLocalInput(booking.ends_at));
      setNotes(booking.notes ?? "");
    } else {
      setClientId("");
      setServiceId("");
      setPractitionerId("");
      const start = defaultStartsAt ?? new Date().toISOString();
      setStartsLocal(toLocalInput(start));
      setEndsLocal("");
      setNotes("");
    }
    setNewClientMode(false);
  }, [open, booking, defaultStartsAt]);

  // When creating a new booking, suggest the next available start = last booking's
  // ends_at + its service's buffer_minutes (scoped to the selected practitioner if any).
  const suggestedStartRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || booking) return;
    if (dayBookings.length === 0) return;
    const relevant = practitionerId
      ? dayBookings.filter((b) => b.practitioner_id === practitionerId)
      : dayBookings;
    if (relevant.length === 0) return;
    const last = relevant.reduce((a, b) =>
      new Date(a.ends_at) > new Date(b.ends_at) ? a : b,
    );
    const buffer = last.service?.buffer_minutes ?? 0;
    const suggested = new Date(new Date(last.ends_at).getTime() + buffer * 60_000);
    const suggestedIso = suggested.toISOString();
    if (suggestedStartRef.current === suggestedIso) return;
    suggestedStartRef.current = suggestedIso;
    setStartsLocal(toLocalInput(suggestedIso));
    setEndsLocal("");
  }, [open, booking, dayBookings, practitionerId]);

  const startMinFromTop = (s: string) => {
    const [sh, sm] = s.split(":").map(Number);
    return sh * 60 + sm;
  };

  const warnings = useMemo(() => {
    const out: string[] = [];
    if (!startsLocal || !endsLocal || !practitionerId) return out;
    const start = new Date(startsLocal);
    const end = new Date(endsLocal);
    const day = start.getDay();
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const slots = availability.filter(
      (a) =>
        a.practitioner_id === practitionerId && a.is_active && a.day_of_week === day,
    );
    if (slots.length === 0) {
      out.push("This practitioner has no availability set for this weekday.");
    } else {
      const inside = slots.some((s) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        return startMin >= sh * 60 + sm && endMin <= eh * 60 + em;
      });
      if (!inside) out.push("Slot falls outside this practitioner's availability.");
    }
    return out;
  }, [startsLocal, endsLocal, practitionerId, availability]);

  const canSave =
    !!(clientId && serviceId && practitionerId && startsLocal && endsLocal) &&
    new Date(endsLocal) > new Date(startsLocal);

  const submit = async () => {
    setSaving(true);
    try {
      let effectiveClientId = clientId;
      if (newClientMode) {
        if (!newFirst.trim() || !newLast.trim()) {
          toast.error("First and last name are required for a new client");
          setSaving(false);
          return;
        }
        const created = await createClientFn({
          data: {
            first_name: newFirst.trim(),
            last_name: newLast.trim(),
            email: newEmail.trim() || undefined,
            phone: newPhone.trim() || undefined,
          },
        });
        effectiveClientId = created.id;
      }
      const payload = {
        client_id: effectiveClientId,
        service_id: serviceId,
        practitioner_id: practitionerId,
        starts_at: fromLocalInput(startsLocal),
        ends_at: fromLocalInput(endsLocal),
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
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} />
                <Input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} />
                <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
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
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger><SelectValue placeholder="Assign a practitioner" /></SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name ?? p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Ends</Label>
              <Input
                type="datetime-local"
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">Heads up</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
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
