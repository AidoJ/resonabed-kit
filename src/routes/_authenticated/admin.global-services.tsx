import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listGlobalServices,
  upsertGlobalService,
  deleteGlobalService,
  type GlobalService,
} from "@/lib/global-services.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/global-services")({
  head: () => ({ meta: [{ title: "Global services, ResonaBed" }] }),
  component: GlobalServicesAdmin,
});

function GlobalServicesAdmin() {
  const list = useServerFn(listGlobalServices);
  const save = useServerFn(upsertGlobalService);
  const del = useServerFn(deleteGlobalService);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["global-services"],
    queryFn: () => list(),
  });
  const [editing, setEditing] = useState<Partial<GlobalService> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);


  const saveMut = useMutation({
    mutationFn: (payload: Partial<GlobalService>) =>
      save({
        data: {
          id: payload.id,
          name: payload.name ?? "",
          duration_minutes: Number(payload.duration_minutes ?? 30),
          buffer_minutes: Number(payload.buffer_minutes ?? 15),
          rrp:
            payload.rrp === null || payload.rrp === undefined || Number.isNaN(Number(payload.rrp))
              ? null
              : Number(payload.rrp),
          is_active: payload.is_active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["global-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["global-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        These are the default services copied into every new clinic at creation. Each clinic then
        sets its own price and can activate, rename or delete its copy. Editing a global entry
        does <strong>not</strong> retroactively change existing clinics' services.
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setEditing({ is_active: true, duration_minutes: 30, buffer_minutes: 15 })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> New global service
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Changeover</TableHead>
            <TableHead>RRP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6}>Loading…</TableCell>
            </TableRow>
          ) : (data ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No global services yet.
              </TableCell>
            </TableRow>
          ) : (
            (data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.duration_minutes} min</TableCell>
                <TableCell className="text-muted-foreground">{s.buffer_minutes} min</TableCell>
                <TableCell>
                  {s.rrp === null || s.rrp === undefined ? (
                    <span className="text-muted-foreground">No RRP set</span>
                  ) : (
                    `$${Number(s.rrp).toFixed(2)}`
                  )}
                </TableCell>
                <TableCell>
                  {s.is_active ? (
                    <Badge>Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete global service "${s.name}"?`)) delMut.mutate(s.id);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit global service" : "New global service"}
            </DialogTitle>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <Label>Changeover (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={editing.buffer_minutes ?? 15}
                    onChange={(e) =>
                      setEditing({ ...editing, buffer_minutes: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Recommended retail price (RRP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="Leave blank for no recommendation"
                  value={editing.rrp ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      rrp: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A guide only. New clinics start with this as their price and can change it
                  freely; existing clinic prices are never touched.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Active in catalogue</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
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
