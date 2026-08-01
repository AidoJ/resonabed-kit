import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  listAvailability,
  upsertAvailability,
  deleteAvailability,
} from "@/lib/availability.functions";
import { listOrgPractitioners } from "@/lib/bookings.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { tzAbbrev } from "@/lib/timezone";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "Availability, ResonaBed" }] }),
  component: AvailabilityPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function AvailabilityPage() {
  const listFn = useServerFn(listAvailability);
  const listPracs = useServerFn(listOrgPractitioners);
  const upsertFn = useServerFn(upsertAvailability);
  const deleteFn = useServerFn(deleteAvailability);
  const ctxFn = useServerFn(getCurrentUserContext);
  // Availability is stored as wall-clock time; it is always read as the
  // organisation's local time, never the device's.
  const tz = useOrgTimezone();

  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  const { data: practitioners = [] } = useQuery({
    queryKey: ["org-practitioners"],
    queryFn: () => listPracs(),
  });

  const roles = ctx?.roles ?? [];
  const isAdmin = roles.includes("org_admin") || roles.includes("super_admin");
  const myId = ctx?.userId ?? "";

  const [selected, setSelected] = useState<string>("");
  const practitionerId = isAdmin ? selected || myId : myId;

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["availability", practitionerId],
    queryFn: () => listFn({ data: { practitioner_id: practitionerId || undefined } }),
    enabled: !!practitionerId,
  });

  const byDay = useMemo(() => {
    const map = new Map<number, typeof rows>();
    for (const r of rows) {
      const arr = map.get(r.day_of_week) ?? [];
      arr.push(r);
      map.set(r.day_of_week, arr);
    }
    return map;
  }, [rows]);

  const [draftDay, setDraftDay] = useState<number | null>(null);
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [saving, setSaving] = useState(false);

  const addSlot = async (day: number) => {
    if (!practitionerId) return;
    setSaving(true);
    try {
      await upsertFn({
        data: {
          practitioner_id: practitionerId,
          day_of_week: day,
          start_time: draftStart,
          end_time: draftEnd,
          is_active: true,
        },
      });
      toast.success("Availability added");
      setDraftDay(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean, r: (typeof rows)[number]) => {
    try {
      await upsertFn({
        data: {
          id,
          practitioner_id: r.practitioner_id,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: !current,
        },
      });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this availability slot?")) return;
    try {
      await deleteFn({ data: { id } });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Weekly availability</h1>
        <p className="text-sm text-muted-foreground">
          Recurring hours in your clinic's timezone, {tzAbbrev(tz)} ({tz}). Bookings outside
          these hours are flagged but still allowed.
        </p>
      </div>

      {isAdmin && (
        <div className="space-y-1">
          <Label>Practitioner</Label>
          <Select value={practitionerId} onValueChange={setSelected}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Pick a practitioner" /></SelectTrigger>
            <SelectContent>
              {practitioners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name ?? p.id.slice(0, 8)} {p.id === myId ? "(me)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {DAYS.map((label, day) => {
          const slots = byDay.get(day) ?? [];
          const isDrafting = draftDay === day;
          return (
            <div key={day} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{label}</p>
                {!isDrafting && (
                  <Button size="sm" variant="ghost" onClick={() => setDraftDay(day)}>
                    <Plus className="mr-1 h-4 w-4" /> Add slot
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {slots.length === 0 && !isDrafting && (
                  <p className="text-sm text-muted-foreground">No hours set.</p>
                )}
                {slots.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-md bg-muted/30 p-2">
                    <span className="flex-1 tabular-nums">
                      {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                      <span className="ml-2 text-xs text-muted-foreground">{tzAbbrev(tz)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r.id, r.is_active, r)} />
                      <span className="text-xs text-muted-foreground">
                        {r.is_active ? "Active" : "Off"}
                      </span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {isDrafting && (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input type="time" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} className="h-10 w-32" />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input type="time" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} className="h-10 w-32" />
                    </div>
                    <Button size="sm" onClick={() => addSlot(day)} disabled={saving || !practitionerId}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraftDay(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
