import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Music, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  deleteFrequency,
  listFrequencies,
  upsertFrequency,
} from "@/lib/sessions.functions";
import {
  createAudioFileRow,
  finalizeAudioFile,
  listOrgAudioFiles,
  setAudioFileActive,
} from "@/lib/audio.functions";
import { supabase } from "@/integrations/supabase/client";
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
import { AUDIO_VARIANTS, VARIANT_LABELS, type AudioVariant } from "@/lib/audio-variants";

export const Route = createFileRoute("/_authenticated/frequencies")({
  head: () => ({
    meta: [
      { title: "Frequencies, ResonaBed" },
      { name: "description", content: "The nine Solfeggio wellbeing frequencies available in the Resonabed session player." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FrequenciesPage,
});

interface FrequencyEditable {
  id?: string;
  hz: number;
  name: string;
  description: string;
  benefits: string;
  traditional_associations: string;
  color: string;
  goal_tags: string[];
  body_area_tags: string[];
}

const EMPTY: FrequencyEditable = {
  hz: 0,
  name: "",
  description: "",
  benefits: "",
  traditional_associations: "",
  color: "#7B8FC7",
  goal_tags: [],
  body_area_tags: [],
};

const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave";

async function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = el.duration;
      URL.revokeObjectURL(url);
      resolve(isFinite(d) ? Math.round(d) : null);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}

function fmtDuration(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  const listAudioFn = useServerFn(listOrgAudioFiles);
  const createAudioRowFn = useServerFn(createAudioFileRow);
  const finalizeAudioFn = useServerFn(finalizeAudioFile);
  const setAudioActiveFn = useServerFn(setAudioFileActive);

  const { data, isLoading } = useQuery({
    queryKey: ["frequencies-admin"],
    queryFn: () => listFn(),
  });

  // Global tracks (org_id IS NULL) so the edit dialog can show and replace the
  // sound file that plays for each frequency.
  const { data: audioFiles } = useQuery({
    queryKey: ["audio-files"],
    queryFn: () => listAudioFn(),
  });
  const globalAudio = (audioFiles ?? []).filter((a) => a.org_id === null);

  const [editing, setEditing] = useState<FrequencyEditable | null>(null);
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [audioVariant, setAudioVariant] = useState<AudioVariant>("original");
  const [saving, setSaving] = useState(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const openEditor = (v: FrequencyEditable | null) => {
    setPendingAudio(null);
    setEditing(v);
  };

  const uploadGlobalAudio = async (frequencyId: string, file: File) => {
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!["mp3", "wav"].includes(ext)) {
      throw new Error("Only MP3 or WAV files are supported");
    }
    const duration = await readAudioDuration(file);
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Global track";
    // Ambient versions keep the ambience already recorded for this frequency.
    const ambience =
      globalAudio.find((a) => a.frequency_id === frequencyId && a.ambience_kind)?.ambience_kind ??
      null;
    const row = await createAudioRowFn({
      data: {
        title,
        frequency_id: frequencyId,
        is_global: true,
        variant: audioVariant,
        ambience_kind: ambience as "water" | "wind" | null,
      },
    });
    const path = `global/${row.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("audio-files")
      .upload(path, file, {
        contentType: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
    // Finalize activates the new track and switches off the previous one of
    // the SAME version only; the other versions of this frequency are kept.
    await finalizeAudioFn({ data: { id: row.id, file_url: path, duration_seconds: duration } });
  };

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

  const submit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name is required");
    if (!editing.hz || editing.hz < 1) return toast.error("Hz must be a positive number");
    const flagged =
      containsMedicalClaim(editing.description) ??
      containsMedicalClaim(editing.benefits);
    if (flagged) {
      return toast.error(
        `Please rephrase, "${flagged}" is a medical/therapeutic term. Use wellbeing language only.`,
      );
    }
    setSaving(true);
    try {
      const saved = await upsertFn({
        data: {
          id: editing.id,
          hz: editing.hz,
          name: editing.name,
          description: editing.description || null,
          benefits: editing.benefits || null,
          traditional_associations: editing.traditional_associations || null,
          color: editing.color || null,
          goal_tags: editing.goal_tags,
          body_area_tags: editing.body_area_tags,
        },
      });
      if (pendingAudio) {
        await uploadGlobalAudio(saved.id, pendingAudio);
      }
      toast.success(pendingAudio ? "Frequency and sound file saved" : "Frequency saved");
      setEditing(null);
      setPendingAudio(null);
      qc.invalidateQueries({ queryKey: ["frequencies-admin"] });
      qc.invalidateQueries({ queryKey: ["frequencies-with-audio"] });
      qc.invalidateQueries({ queryKey: ["audio-files"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frequencies</h1>
          <p className="text-sm text-muted-foreground">
            Manage the frequency library. Matching uses the target-Hz model, the intake
            wizard computes a target Hz and ranks frequencies by proximity.
          </p>
        </div>
        <Button onClick={() => openEditor({ ...EMPTY })} className="h-11">
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
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${f.hz} Hz ${f.name}`}
                      onClick={() =>
                        openEditor({
                          id: f.id,
                          hz: f.hz,
                          name: f.name,
                          description: f.description ?? "",
                          benefits: f.benefits ?? "",
                          traditional_associations: f.traditional_associations ?? "",
                          color: f.color ?? "#7B8FC7",
                          goal_tags: f.goal_tags ?? [],
                          body_area_tags: f.body_area_tags ?? [],
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && openEditor(null)}>
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
                <Label htmlFor="description">Full description (shown on the recommended card)</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="A gentle tone commonly used to encourage…"
                />
              </div>
              <div>
                <Label htmlFor="benefits">Short description (shown in "Or choose another")</Label>
                <Textarea
                  id="benefits"
                  rows={3}
                  value={editing.benefits}
                  onChange={(e) => setEditing({ ...editing, benefits: e.target.value })}
                  placeholder="Two-line summary…"
                />
              </div>


              <div>
                <Label htmlFor="traditional">
                  Traditional associations (practitioner reference only)
                </Label>
                <Textarea
                  id="traditional"
                  rows={4}
                  value={editing.traditional_associations}
                  onChange={(e) =>
                    setEditing({ ...editing, traditional_associations: e.target.value })
                  }
                  placeholder="Traditionally described as…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown only to signed-in practitioners in the session wizard, never on public
                  clinic pages. Write it as tradition and background, not as an outcome a client
                  can expect.
                </p>
              </div>

              <ChipGroup
                label="Goal tags (used as a tiebreak when frequencies are within 10 Hz of the target)"
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

              <div className="rounded-md border p-3 space-y-3">
                <Label className="flex items-center gap-2">
                  <Music className="h-4 w-4" /> Sound file (global track)
                </Label>
                <select
                  aria-label="Version to replace"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={audioVariant}
                  onChange={(e) => setAudioVariant(e.target.value as AudioVariant)}
                >
                  {AUDIO_VARIANTS.map((v) => (
                    <option key={v} value={v}>
                      {VARIANT_LABELS[v]}
                    </option>
                  ))}
                </select>
                {(() => {
                  const ofVariant = globalAudio.filter(
                    (a) => a.frequency_id === editing.id && (a.variant ?? "original") === audioVariant,
                  );
                  const current = editing.id
                    ? ofVariant
                        .filter((a) => a.is_active && a.file_url)
                        .concat(ofVariant.filter((a) => !a.is_active || !a.file_url))[0]
                    : null;
                  return (
                    <p className="text-xs text-muted-foreground">
                      {current
                        ? `Current: ${current.title} · ${fmtDuration(current.duration_seconds)}${current.is_active ? "" : " (inactive)"}`
                        : `No ${VARIANT_LABELS[audioVariant]} sound file for this frequency yet.`}
                    </p>
                  );
                })()}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT}
                  className="hidden"
                  onChange={(e) => setPendingAudio(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {pendingAudio ? "Choose a different file" : "Upload replacement (MP3 or WAV)"}
                  </Button>
                  {pendingAudio ? (
                    <span className="text-xs text-muted-foreground">
                      {pendingAudio.name} · {(pendingAudio.size / (1024 * 1024)).toFixed(1)} MB —
                      replaces the current track when you save
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  The new track becomes the global sound for this frequency in every
                  organisation's sessions. The previous track is kept but switched off.
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => openEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save"
              )}
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
