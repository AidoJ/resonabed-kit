import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listClientsAdmin,
  upsertClient,
  getClientSessionHistory,
} from "@/lib/admin.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, History, MailWarning } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientCheckinTrends } from "@/components/checkin/trend-chart";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients, ResonaBed" }] }),
  component: ClientsPage,
});

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  email_status?: "valid" | "bounced" | "complained" | "unsubscribed";
};

const EMAIL_STATUS_LABEL: Record<string, string> = {
  bounced: "Email undeliverable (bounced)",
  complained: "Recipient marked as spam",
  unsubscribed: "Recipient unsubscribed",
};

function ClientsPage() {
  const list = useServerFn(listClientsAdmin);
  const save = useServerFn(upsertClient);
  const history = useServerFn(getClientSessionHistory);
  const fetchCtx = useServerFn(getCurrentUserContext);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: ctx } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });
  const canManage = ctx?.permissions?.manageClients ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ["clinic-clients", search],
    queryFn: () => list({ data: { search: search || undefined } }),
  });
  const [editing, setEditing] = useState<Partial<ClientRow> | null>(null);
  const [historyOf, setHistoryOf] = useState<ClientRow | null>(null);

  const historyQuery = useQuery({
    queryKey: ["client-history", historyOf?.id],
    queryFn: () => history({ data: { client_id: historyOf!.id } }),
    enabled: !!historyOf,
  });

  const saveMut = useMutation({
    mutationFn: (p: Partial<ClientRow>) =>
      save({
        data: {
          id: p.id,
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
          email: p.email ?? null,
          phone: p.phone ?? null,
          date_of_birth: p.date_of_birth ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Client saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["clinic-clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {canManage ? "Add and update client records for your clinic." : "Client records for your clinic."}
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canManage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="mr-2 h-4 w-4" /> New client
          </Button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
          ) : (data ?? []).length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-muted-foreground">No clients.</TableCell></TableRow>
          ) : (
            (data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.last_name}, {c.first_name}</TableCell>
                <TableCell>
                  {c.email ? (
                    <div className="flex items-center gap-2">
                      <span className={c.email_status && c.email_status !== "valid" ? "line-through text-muted-foreground" : ""}>
                        {c.email}
                      </span>
                      {c.email_status && c.email_status !== "valid" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="destructive" className="gap-1">
                              <MailWarning className="h-3 w-3" />
                              {c.email_status === "bounced" ? "Undeliverable" : c.email_status === "complained" ? "Spam" : "Unsubscribed"}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{EMAIL_STATUS_LABEL[c.email_status]}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setHistoryOf(c)}>
                    <History className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit client" : "New client"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>First name</Label>
                  <Input
                    value={editing.first_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input
                    value={editing.last_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={editing.date_of_birth ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, date_of_birth: e.target.value || null })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.first_name || !editing?.last_name}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Session history, {historyOf?.first_name} {historyOf?.last_name}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyQuery.isLoading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : (historyQuery.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No sessions.</TableCell></TableRow>
              ) : (
                (historyQuery.data ?? []).map((s) => {
                  const svc = s.service as { name: string } | null;
                  const f = s.frequency as { hz: number; name: string } | null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.created_at as string).toLocaleString()}</TableCell>
                      <TableCell>{svc?.name ?? "—"}</TableCell>
                      <TableCell>{f ? `${f.hz} Hz` : "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{s.status as string}</Badge></TableCell>
                      <TableCell>
                        {s.payment_method === "none" || !s.payment_method
                          ? <Badge variant="outline">Unpaid</Badge>
                          : `${s.payment_method} ${s.payment_amount ?? ""}`}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
