import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listServices, upsertService, deleteService } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/services")({
  head: () => ({ meta: [{ title: "Services — Admin — ResonaBed" }] }),
  component: ServicesAdmin,
});

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  is_active: boolean;
};

function ServicesAdmin() {
  const list = useServerFn(listServices);
  const save = useServerFn(upsertService);
  const del = useServerFn(deleteService);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-services"], queryFn: () => list() });
  const [editing, setEditing] = useState<Partial<Service> | null>(null);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<Service>) =>
      save({
        data: {
          id: payload.id,
          name: payload.name ?? "",
          duration_minutes: Number(payload.duration_minutes ?? 30),
          price: Number(payload.price ?? 0),
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ is_active: true, duration_minutes: 30, price: 0 })}>
          <Plus className="mr-2 h-4 w-4" /> New service
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
          ) : (data ?? []).length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-muted-foreground">No services yet.</TableCell></TableRow>
          ) : (
            (data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.duration_minutes} min</TableCell>
                <TableCell>{Number(s.price).toFixed(2)}</TableCell>
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
