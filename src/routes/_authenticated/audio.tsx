import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Play, Pause, Plus, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { listFrequencies } from "@/lib/sessions.functions";
import {
  createAudioFileRow,
  deleteAudioFile,
  finalizeAudioFile,
  getSignedAudioUrlById,
  listOrgAudioFiles,
  setAudioFileActive,
} from "@/lib/audio.functions";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/audio")({
  head: () => ({ meta: [{ title: "Audio library — ResonaBed" }] }),
  component: AudioPage,
});

const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave";

function AudioPage() {
  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx, isLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => ctxFn(),
  });

  if (isLoading) return <Skeleton className="h-40 w-full max-w-4xl" />;

  const allowed =
    !!ctx?.roles.includes("super_admin") || !!ctx?.roles.includes("org_admin");

  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <Alert>
          <AlertTitle>Restricted</AlertTitle>
          <AlertDescription>
            The audio library is available to organisation admins.
            <div className="mt-2">
              <Link to="/dashboard" className="underline">
                Back to dashboard
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AudioLibrary isSuperAdmin={!!ctx?.roles.includes("super_admin")} />;
}

interface AudioRow {
  id: string;
  org_id: string | null;
  title: string;
  frequency_id: string | null;
  file_url: string | null;
  duration_seconds: number | null;
  is_active: boolean;
  created_at: string;
}

function fmtDuration(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

function AudioLibrary({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const qc = useQueryClient();
  const listFreqFn = useServerFn(listFrequencies);
  const listFn = useServerFn(listOrgAudioFiles);
  const createRowFn = useServerFn(createAudioFileRow);
  const finalizeFn = useServerFn(finalizeAudioFile);
  const setActiveFn = useServerFn(setAudioFileActive);
  const deleteFn = useServerFn(deleteAudioFile);
  const signFn = useServerFn(getSignedAudioUrlById);

  const { data: frequencies, isLoading: freqLoading } = useQuery({
    queryKey: ["frequencies-list"],
    queryFn: () => listFreqFn(),
  });

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["audio-files"],
    queryFn: () => listFn(),
  });

  const byFreq = useMemo(() => {
    const m = new Map<string, AudioRow[]>();
    for (const f of files ?? []) {
      const key = f.frequency_id ?? "unassigned";
      const list = m.get(key) ?? [];
      list.push(f as AudioRow);
      m.set(key, list);
    }
    return m;
  }, [files]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [presetFreqId, setPresetFreqId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setActiveMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => setActiveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-files"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Audio deleted");
      qc.invalidateQueries({ queryKey: ["audio-files"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const previewMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await signFn({ data: { id } });
      return { id, url: res.url };
    },
    onSuccess: ({ id, url }) => {
      setPlaying({ id, url });
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not load preview"),
  });

  const openUpload = (frequencyId?: string) => {
    setPresetFreqId(frequencyId ?? null);
    setUploadOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audio library</h1>
          <p className="text-sm text-muted-foreground">
            Upload audio files and assign them to frequencies. Only active files are used
            by the session player.
          </p>
        </div>
        <Button onClick={() => openUpload()} className="h-11">
          <Plus className="mr-2 h-4 w-4" /> Upload audio
        </Button>
      </header>

      {playing ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Preview</span>
            <audio ref={audioRef} src={playing.url} controls className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setPlaying(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {freqLoading || filesLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {(frequencies ?? []).map((f) => {
            const rows = byFreq.get(f.id) ?? [];
            const activeCount = rows.filter((r) => r.is_active && r.file_url).length;
            const inactiveCount = rows.length - activeCount;
            const status =
              activeCount > 0
                ? { label: `${activeCount} active`, variant: "default" as const }
                : inactiveCount > 0
                  ? { label: "Inactive only", variant: "secondary" as const }
                  : { label: "No audio", variant: "outline" as const };

            return (
              <div key={f.id} className="rounded-lg border">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: f.color ?? "#888" }}
                  />
                  <div className="flex-1 min-w-[140px]">
                    <p className="font-medium">
                      <span className="tabular-nums">{f.hz} Hz</span> · {f.name}
                    </p>
                    {f.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {f.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUpload(f.id)}
                    className="h-9"
                  >
                    <Upload className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>

                {rows.length > 0 ? (
                  <ul className="divide-y border-t">
                    {rows.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3"
                      >
                        <div className="flex-1 min-w-[160px]">
                          <p className="text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDuration(r.duration_seconds)} ·{" "}
                            {new Date(r.created_at).toLocaleDateString()}
                            {r.file_url ? "" : " · upload incomplete"}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!r.file_url || previewMut.isPending}
                          onClick={() => {
                            if (playing?.id === r.id) {
                              setPlaying(null);
                            } else {
                              previewMut.mutate(r.id);
                            }
                          }}
                          className="h-9"
                        >
                          {playing?.id === r.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={r.is_active}
                            onCheckedChange={(v) =>
                              setActiveMut.mutate({ id: r.id, is_active: v })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete "${r.title}"?`)) deleteMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {(frequencies ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No frequencies configured yet.</p>
          ) : null}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        frequencies={frequencies ?? []}
        presetFrequencyId={presetFreqId}
        isSuperAdmin={isSuperAdmin}
        createRow={async (v) => createRowFn({ data: v })}
        finalize={async (v) => finalizeFn({ data: v })}
        remove={async (id) => deleteFn({ data: { id } })}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["audio-files"] });
          qc.invalidateQueries({ queryKey: ["frequencies-with-audio"] });
        }}
      />
    </div>
  );
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  frequencies: Array<{ id: string; hz: number; name: string }>;
  presetFrequencyId: string | null;
  isSuperAdmin: boolean;
  createRow: (v: { title: string; frequency_id: string; is_global?: boolean }) => Promise<{
    id: string;
    org_id: string | null;
  }>;
  finalize: (v: {
    id: string;
    file_url: string;
    duration_seconds: number | null;
  }) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  onDone: () => void;
}

function UploadDialog({
  open,
  onOpenChange,
  frequencies,
  presetFrequencyId,
  createRow,
  finalize,
  remove,
  onDone,
}: UploadDialogProps) {
  const [title, setTitle] = useState("");
  const [frequencyId, setFrequencyId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset when opened.
  const openedRef = useRef(false);
  if (open && !openedRef.current) {
    openedRef.current = true;
    setTitle("");
    setFrequencyId(presetFrequencyId ?? "");
    setFile(null);
  } else if (!open && openedRef.current) {
    openedRef.current = false;
  }

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!frequencyId) return toast.error("Select a frequency");
    if (!file) return toast.error("Choose an audio file");

    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!["mp3", "wav"].includes(ext)) {
      return toast.error("Only MP3 or WAV files are supported");
    }

    setBusy(true);
    let createdId: string | null = null;
    try {
      const duration = await readAudioDuration(file);
      const row = await createRow({ title: title.trim(), frequency_id: frequencyId });
      createdId = row.id;
      const path = `${row.org_id}/${row.id}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("audio-files")
        .upload(path, file, {
          contentType: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      await finalize({ id: row.id, file_url: path, duration_seconds: duration });
      toast.success("Audio uploaded");
      onDone();
      onOpenChange(false);
    } catch (e) {
      if (createdId) {
        try {
          await remove(createdId);
        } catch {
          // swallow — user can clean up manually
        }
      }
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload audio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 396 Hz — Deep rest loop"
            />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequencyId} onValueChange={setFrequencyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a frequency" />
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.hz} Hz · {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="file">Audio file (MP3 or WAV)</Label>
            <Input
              id="file"
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
