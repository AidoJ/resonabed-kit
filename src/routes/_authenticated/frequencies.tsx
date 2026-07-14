import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteFrequency,
  listFrequencies,
  upsertFrequency,
} from "@/lib/sessions.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  BODY_AREA_OPTIONS,
  GOAL_OPTIONS,
} from "@/lib/frequency-match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/frequencies")({
  head: () => ({ meta: [{ title: "Frequencies — ResonaBed" }] }),
  component: FrequenciesPage,
});

interface FrequencyEditable {
  id?: string;
  hz: number;
  name: string;
  description: string;
  benefits: string;
  color: string;
  goal_tags: string[];
  body_area_tags: string[];
  pain_affinity: number;
  stress_affinity: number;
  sleep_affinity: number;
}

const EMPTY: FrequencyEditable = {
  hz: 0,
  name: "",
  description: "",
  benefits: "",
  color: "#7B8FC7",
  goal_tags: [],
  body_area_tags: [],
  pain_affinity: 0,
  stress_affinity: 0,
  sleep_affinity: 0,
};

// Wellbeing-only language: block obvious medical/therapeutic claims in text fields.
const FORBIDDEN_WORDS = [
  "heal", "healing", "cure", "cures", "treat", "treatment", "therapy",
  "diagnose", "diagnosis", "medical", "medicine", "disease", "disorder",
  "DNA", "cellular repair", "regeneration", "anesthetic", "anaesthetic",
  "pain relief", "arthritis", "cancer", "depression", "anxiety disorder",
];

function containsMedicalClaim(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return null;
}

function FrequenciesPage() {
  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => ctxFn(),
  });

  if (ctxLoading) return <Skeleton className="h-40 w-full max-w-3xl" />;

  const isSuper = ctx?.roles.includes("super_admin");
  if (!isSuper) {
    return (
      <div className="max-w-2xl">
        <Alert>
          <AlertTitle>Restricted</AlertTitle>
          <AlertDescription>
            Frequency management is available to super admins only.
            <div className="mt-2">
              <Link to="/dashboard" className="underline">Back to dashboard</Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <FrequenciesAdmin />;
}

function FrequenciesAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFrequencies);
  const upsertFn = useServerFn(upsertFrequency);
  const deleteFn = useServerFn(deleteFrequency);

  const { data, isLoading } = useQuery({
    queryKey: ["frequencies-admin"],
    queryFn: () => listFn(),
  });

  const [editing, setEditing] = useState<FrequencyEditable | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: FrequencyEditable) =>
      upsertFn({
        data: {
          id: v.id,
          hz: v.hz,
          name: v.name,
          description: v.description || null,
          benefits: v.benefits || null,
          color: v.color || null,
          goal_tags: v.goal_tags,
          body_area_tags: v.body_area_tags,
          pain_affinity: v.pain_affinity,
          stress_affinity: v.stress_affinity,
          sleep_affinity: v.sleep_affinity,
        },
      }),
    onSuccess: () => {
      toast.success("Frequency saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["frequencies-admin"] });
      qc.invalidateQueries({ queryKey: ["frequencies-with-audio"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Frequency deleted");
      qc.invalidateQueries({ queryKey: ["frequencies-admin"] });
      qc.invalidateQueries({ queryKey: ["frequencies-with-audio"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const submit = () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name is required");
    if (!editing.hz || editing.hz < 1) return toast.error("Hz must be a positive number");
    const flagged =
      containsMedicalClaim(editing.description) ??
      containsMedicalClaim(editing.benefits);
    if (flagged) {
      return toast.error(
        `Please rephrase — "${flagged}" is a medical/therapeutic term. Use wellbeing language only.`,
      );
    }
    upsertMut.mutate(editing);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frequencies</h1>
          <p className="text-sm text-muted-foreground">
            Manage the frequency library and tune the matching signals used by the intake wizard.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })} className="h-11">
          <Plus className="mr-2 h-4 w-4" /> New frequency
        </Button>
      </header>

      <Alert>
        <AlertTitle>Wellbeing language only</AlertTitle>
        <AlertDescription>
          Descriptions and benefits must avoid medical, diagnostic or therapeutic claims. Use
          language like "supports rest", "encourages calm", "gentle grounding".
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hz</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Goals</TableHead>
              <TableHead>Body areas</TableHead>
              <TableHead className="text-center">Pain</TableHead>
              <TableHead className="text-center">Stress</TableHead>
              <TableHead className="text-center">Sleep</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No frequencies yet.
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium tabular-nums">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: f.color ?? "#888" }}
                      />
                      {f.hz}
                    </div>
                  </TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(f.goal_tags ?? []).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(f.body_area_tags ?? []).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{f.pain_affinity}</TableCell>
                  <TableCell className="text-center tabular-nums">{f.stress_affinity}</TableCell>
                  <TableCell className="text-center tabular-nums">{f.sleep_affinity}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          id: f.id,
                          hz: f.hz,
                          name: f.name,
                          description: f.description ?? "",
                          benefits: f.benefits ?? "",
                          color: f.color ?? "#7B8FC7",
                          goal_tags: f.goal_tags ?? [],
                          body_area_tags: f.body_area_tags ?? [],
                          pain_affinity: f.pain_affinity ?? 0,
                          stress_affinity: f.stress_affinity ?? 0,
                          sleep_affinity: f.sleep_affinity ?? 0,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete ${f.hz} Hz · ${f.name}?`)) deleteMut.mutate(f.id);
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
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit frequency" : "New frequency"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hz">Hz</Label>
                  <Input
                    id="hz"
                    type="number"
                    min={1}
                    value={editing.hz || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, hz: parseInt(e.target.value || "0", 10) })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color"
                    type="color"
                    value={editing.color}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    value={editing.color}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    placeholder="#RRGGBB"
                    className="max-w-[140px]"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="A gentle tone commonly used to encourage…"
                />
              </div>
              <div>
                <Label htmlFor="benefits">Benefits</Label>
                <Textarea
                  id="benefits"
                  rows={2}
                  value={editing.benefits}
                  onChange={(e) => setEditing({ ...editing, benefits: e.target.value })}
                  placeholder="Supports rest and calm…"
                />
              </div>

              <ChipGroup
                label="Goal tags"
                options={GOAL_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                selected={editing.goal_tags}
                onToggle={(v) =>
                  setEditing({
                    ...editing,
                    goal_tags: editing.goal_tags.includes(v)
                      ? editing.goal_tags.filter((x) => x !== v)
                      : [...editing.goal_tags, v],
                  })
                }
              />

              <ChipGroup
                label="Body area tags"
                options={BODY_AREA_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                selected={editing.body_area_tags}
                onToggle={(v) =>
                  setEditing({
                    ...editing,
                    body_area_tags: editing.body_area_tags.includes(v)
                      ? editing.body_area_tags.filter((x) => x !== v)
                      : [...editing.body_area_tags, v],
                  })
                }
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <AffinityRow
                  label="Pain affinity"
                  value={editing.pain_affinity}
                  onChange={(v) => setEditing({ ...editing, pain_affinity: v })}
                />
                <AffinityRow
                  label="Stress affinity"
                  value={editing.stress_affinity}
                  onChange={(v) => setEditing({ ...editing, stress_affinity: v })}
                />
                <AffinityRow
                  label="Sleep affinity"
                  value={editing.sleep_affinity}
                  onChange={(v) => setEditing({ ...editing, sleep_affinity: v })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={upsertMut.isPending}>
              {upsertMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AffinityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <Slider
        min={0}
        max={5}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
    </div>
  );
}
