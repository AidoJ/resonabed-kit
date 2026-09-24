import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { getCurrentUserContext } from "@/lib/user-context.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addDemoLeadNote,
  deleteDemoLead,
  getDemoLead,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  listDemoLeads,
  updateDemoLead,
  type LeadRow,
  type LeadStage,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "CRM, ResonaBed" },
      { name: "description", content: "Follow-up desk for demo enquiries." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmPage,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

function StageBadge({ stage }: { stage: LeadStage }) {
  const variant =
    stage === "won" ? "default" : stage === "lost" ? "outline" : stage === "new" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="whitespace-nowrap text-xs">
      {LEAD_STAGE_LABELS[stage]}
    </Badge>
  );
}

function CrmPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const fetchLeads = useServerFn(listDemoLeads);
  const navigate = useNavigate();
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });
  const isSuperAdmin = !!ctx?.roles.includes("super_admin");

  useEffect(() => {
    if (ctx && !isSuperAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [ctx, isSuperAdmin, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-leads"],
    queryFn: () => fetchLeads(),
    enabled: isSuperAdmin,
  });

  const [stageFilter, setStageFilter] = useState<LeadStage | "all" | "due">("all");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const today = data?.today ?? "";
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter === "due") {
        const open = r.stage !== "won" && r.stage !== "lost";
        const due = r.nextFollowUpOn && r.nextFollowUpOn <= today;
        if (!(open && (r.stage === "new" || due))) return false;
      } else if (stageFilter !== "all" && r.stage !== stageFilter) {
        return false;
      }
      if (unassignedOnly && r.ownerId) return false;
      if (term) {
        const hay = `${r.name} ${r.practice} ${r.email}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, stageFilter, unassignedOnly, search]);

  if (ctxLoading || !isSuperAdmin || isLoading)
    return <p className="text-sm text-muted-foreground">Loading enquiries…</p>;
  if (error)
    return <p className="text-sm text-destructive">Could not load enquiries: {(error as Error).message}</p>;

  const selected = (data?.rows ?? []).find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Demo enquiries from the website, with a follow-up flow for each one.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={stageFilter === "all"} onClick={() => setStageFilter("all")}>
          All
        </FilterChip>
        <FilterChip active={stageFilter === "due"} onClick={() => setStageFilter("due")}>
          Needs attention
        </FilterChip>
        {LEAD_STAGES.map((s) => (
          <FilterChip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>
            {LEAD_STAGE_LABELS[s]}
          </FilterChip>
        ))}
        <FilterChip active={unassignedOnly} onClick={() => setUnassignedOnly((v) => !v)}>
          Unassigned
        </FilterChip>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, practice or email"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Suburb</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Next follow-up</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                  No enquiries match this view.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.practice}</TableCell>
                  <TableCell>{r.suburb}</TableCell>
                  <TableCell>
                    <StageBadge stage={r.stage} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.ownerName ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <FollowUpCell lead={r} today={data?.today ?? ""} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fmtDate(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? <LeadDetail id={selected.id} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-8 rounded-full"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function FollowUpCell({ lead, today }: { lead: LeadRow; today: string }) {
  if (!lead.nextFollowUpOn) return <span className="text-muted-foreground">—</span>;
  const overdue = lead.nextFollowUpOn < today && lead.stage !== "won" && lead.stage !== "lost";
  return (
    <span className={overdue ? "font-medium text-destructive" : undefined}>
      {fmtDate(lead.nextFollowUpOn)}
      {overdue ? " · overdue" : ""}
    </span>
  );
}

function LeadDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const fetchLead = useServerFn(getDemoLead);
  const saveLead = useServerFn(updateDemoLead);
  const saveNote = useServerFn(addDemoLeadNote);
  const removeLead = useServerFn(deleteDemoLead);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["demo-lead", id],
    queryFn: () => fetchLead({ data: { id } }),
  });

  const [stage, setStage] = useState<LeadStage | null>(null);
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  const [followUp, setFollowUp] = useState<string | null | undefined>(undefined);
  const [lostReason, setLostReason] = useState<string | null | undefined>(undefined);
  const [note, setNote] = useState("");

  const lead = data?.lead;
  const effStage = stage ?? lead?.stage ?? "new";
  const effOwner = ownerId !== undefined ? ownerId : (lead?.ownerId ?? null);
  const effFollowUp = followUp !== undefined ? followUp : (lead?.nextFollowUpOn ?? null);
  const effLostReason = lostReason !== undefined ? lostReason : (lead?.lostReason ?? null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["demo-leads"] });
    await queryClient.invalidateQueries({ queryKey: ["demo-lead", id] });
    await queryClient.invalidateQueries({ queryKey: ["demo-lead-summary"] });
  };

  const update = useMutation({
    mutationFn: () =>
      saveLead({
        data: {
          id,
          stage: effStage,
          ownerId: effOwner,
          nextFollowUpOn: effFollowUp,
          lostReason: effLostReason,
        },
      }),
    onSuccess: async () => {
      setStage(null);
      setOwnerId(undefined);
      setFollowUp(undefined);
      setLostReason(undefined);
      await invalidate();
    },
  });

  const addNote = useMutation({
    mutationFn: () => saveNote({ data: { id, body: note } }),
    onSuccess: async () => {
      setNote("");
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => removeLead({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["demo-leads"] });
      await queryClient.invalidateQueries({ queryKey: ["demo-lead-summary"] });
      queryClient.removeQueries({ queryKey: ["demo-lead", id] });
      toast.success("Enquiry deleted");
      onClose();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{lead?.name ?? "…"}</h2>
            <p className="text-xs text-muted-foreground">{lead?.reference}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close enquiry detail">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isLoading || !lead ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{lead.practice}</p>
                <p className="text-muted-foreground">{lead.suburb}</p>
                <p className="flex items-center gap-2 pt-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                    {lead.email}
                  </a>
                </p>
                {lead.phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                      {lead.phone}
                    </a>
                  </p>
                ) : null}
                {lead.utm ? (
                  <p className="pt-1 text-xs text-muted-foreground">Source: {lead.utm}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">Received {fmtDate(lead.createdAt)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Follow-up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-stage">Stage</Label>
                  <Select value={effStage} onValueChange={(v) => setStage(v as LeadStage)}>
                    <SelectTrigger id="lead-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEAD_STAGE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {effStage === "lost" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-lost-reason">Reason lost</Label>
                    <Input
                      id="lead-lost-reason"
                      value={effLostReason ?? ""}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Short reason"
                      maxLength={500}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="lead-owner">Owner</Label>
                  <Select
                    value={effOwner ?? "none"}
                    onValueChange={(v) => setOwnerId(v === "none" ? null : v)}
                  >
                    <SelectTrigger id="lead-owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(data?.owners ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-followup">Next follow-up date</Label>
                  <Input
                    id="lead-followup"
                    type="date"
                    value={effFollowUp ?? ""}
                    onChange={(e) => setFollowUp(e.target.value || null)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => update.mutate()} disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  {update.error ? (
                    <p className="text-xs text-destructive">{(update.error as Error).message}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Notes &amp; activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note about this enquiry…"
                    maxLength={2000}
                    rows={3}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addNote.mutate()}
                      disabled={addNote.isPending || !note.trim()}
                    >
                      {addNote.isPending ? "Adding…" : "Add note"}
                    </Button>
                    {addNote.error ? (
                      <p className="text-xs text-destructive">{(addNote.error as Error).message}</p>
                    ) : null}
                  </div>
                </div>
                <ul className="space-y-3">
                  {(data?.events ?? []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">No notes or changes yet.</li>
                  ) : (
                    (data?.events ?? []).map((e) => (
                      <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                          {e.actorName ?? "System"} ·{" "}
                          {new Date(e.createdAt).toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {e.type === "stage_change" ? (
                          <p>
                            Stage: {e.fromStage ? LEAD_STAGE_LABELS[e.fromStage] : "—"} →{" "}
                            {e.toStage ? LEAD_STAGE_LABELS[e.toStage] : "—"}
                            {e.body ? ` (${e.body})` : ""}
                          </p>
                        ) : e.type === "assignment" ? (
                          <p>Owner changed</p>
                        ) : (
                          <p className="whitespace-pre-line">{e.body}</p>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>

            <div className="border-t pt-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={remove.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete enquiry
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this enquiry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes {lead.name}&apos;s enquiry and its notes and activity. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => remove.mutate()}
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? "Deleting…" : "Delete permanently"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
