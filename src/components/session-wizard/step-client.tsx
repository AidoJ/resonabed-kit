import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserPlus, Check } from "lucide-react";
import { listMyOrgClients, createClientRecord } from "@/lib/sessions.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  value: ClientOption | null;
  onChange: (c: ClientOption) => void;
}

export function StepClient({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const listFn = useServerFn(listMyOrgClients);
  const createFn = useServerFn(createClientRecord);
  const qc = useQueryClient();

  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  const canManageClients = ctx?.permissions?.manageClients ?? true;

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => listFn({ data: { search } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setCreating(true);
    try {
      const row = await createFn({ data: form });
      toast.success("Client created");
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "" });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      onChange(row as ClientOption);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            placeholder="Search clients by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" variant="outline" className="h-12">
              <UserPlus className="mr-2 h-4 w-4" /> New client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a new client</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Last name</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Saving…" : "Create client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-md border">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !clients || clients.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No clients found. Create one using the button above.
          </div>
        ) : (
          <ul className="divide-y">
            {clients.map((c) => {
              const selected = value?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onChange(c as ClientOption)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</p>
                    </div>
                    {selected ? <Check className="h-5 w-5 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
