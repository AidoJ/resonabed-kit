import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listServices, upsertService, deleteService, reorderServices } from "@/lib/admin.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown, ImageIcon, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/services")({
  head: () => ({ meta: [{ title: "Services, Admin, ResonaBed" }] }),
  component: ServicesAdmin,
});

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  show_price: boolean;
  is_active: boolean;
  /** Live recommended retail price from the global catalogue. Display only. */
  rrp?: number | null;
  description?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  /** True for the standard vibroacoustic sessions shipped by ResonaBed. */
  is_standard?: boolean;
};

function ServicesAdmin() {
  const list = useServerFn(listServices);
  const save = useServerFn(upsertService);
  const del = useServerFn(deleteService);
  const ctxFn = useServerFn(getCurrentUserContext);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-services"], queryFn: () => list() });
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);


  const saveMut = useMutation({
    mutationFn: (payload: Partial<Service>) =>
      save({
        data: {
          id: payload.id,
          name: payload.name ?? "",
          duration_minutes: Number(payload.duration_minutes ?? 30),
          buffer_minutes: Number(payload.buffer_minutes ?? 15),
          price: Number(payload.price ?? 0),
          show_price: payload.show_price ?? true,
          is_active: payload.is_active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Service saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Service deleted");
      qc.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useServerFn(reorderServices);
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-services"] }),
  });

  const rows = (data ?? []) as Service[];

  function move(index: number, dir: -1 | 1) {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistically reflect the new order while the save runs.
    qc.setQueryData(["admin-services"], next);
    reorderMut.mutate(next.map((s) => s.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Use the arrows to set the order sessions appear on your public page.
        </p>
        <Button onClick={() => setEditing({ is_active: true, show_price: true, duration_minutes: 30, buffer_minutes: 15, price: 0 })}>
          <Plus className="mr-2 h-4 w-4" /> New service
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Changeover</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-muted-foreground">No services yet.</TableCell></TableRow>
          ) : (
            rows.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Move ${s.name} up`}
                      disabled={i === 0 || reorderMut.isPending}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Move ${s.name} down`}
                      disabled={i === rows.length - 1 || reorderMut.isPending}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.duration_minutes} min</TableCell>
                <TableCell className="text-muted-foreground">{s.buffer_minutes} min</TableCell>
                <TableCell>
                  {Number(s.price).toFixed(2)}
                  {s.show_price === false ? (
                    <div className="text-xs text-muted-foreground">Hidden on public page</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    {s.rrp === null || s.rrp === undefined
                      ? "No RRP set"
                      : `Recommended: $${Number(s.rrp).toFixed(2)}`}
                  </div>
                </TableCell>
                <TableCell>
                  {s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) delMut.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={editing.duration_minutes ?? 30}
                    onChange={(e) =>
                      setEditing({ ...editing, duration_minutes: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.price ?? 0}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {editing.rrp === null || editing.rrp === undefined ? (
                      <span>No RRP set</span>
                    ) : (
                      <>
                        <span>Recommended: ${Number(editing.rrp).toFixed(2)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setEditing({ ...editing, price: Number(editing.rrp) })
                          }
                        >
                          Use this
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label>Changeover time (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={240}
                  value={editing.buffer_minutes ?? 15}
                  onChange={(e) =>
                    setEditing({ ...editing, buffer_minutes: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Turnaround after each appointment for cleaning and reset. Not shown to clients; blocks the practitioner from being double-booked.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Switch
                  checked={editing.show_price ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, show_price: v })}
                />
                <div>
                  <Label>Show price on the public page</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Turn this off to list the session without a price. The price is still recorded
                    internally for payments and reporting.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.name}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
