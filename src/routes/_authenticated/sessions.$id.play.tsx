import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Music } from "lucide-react";
import { getSession, getAudioForFrequency, getSignedAudioUrl } from "@/lib/sessions.functions";
import { CountdownTimer } from "@/components/session-player/countdown-timer";
import { AudioPlayer } from "@/components/session-player/audio-player";
import { CompletePanel } from "@/components/session-player/complete-panel";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/sessions/$id/play")({
  head: () => ({ meta: [{ title: "Session — ResonaBed" }] }),
  component: PlaySession,
});

function PlaySession() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSession);
  const audioFn = useServerFn(getAudioForFrequency);
  const signFn = useServerFn(getSignedAudioUrl);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const freqId = session?.recommended_frequency_id ?? null;

  const { data: audio } = useQuery({
    queryKey: ["audio-for-freq", freqId],
    queryFn: () => audioFn({ data: { frequency_id: freqId! } }),
    enabled: !!freqId,
  });

  const { data: signed } = useQuery({
    queryKey: ["signed-audio", audio?.id],
    queryFn: () => signFn({ data: { audio_file_id: audio!.id } }),
    enabled: !!audio?.id,
  });

  if (isLoading || !session) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const client = session.client as { first_name: string; last_name: string } | null;
  const service = session.service as { name: string; duration_minutes: number; price: number } | null;
  const freq = session.frequency as
    | { hz: number; name: string; description: string | null; color: string | null }
    | null;

  const durationSeconds = (service?.duration_minutes ?? 20) * 60;
  const flagged = (session.contraindications ?? []).length > 0;

  if (session.status !== "draft") {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert>
          <AlertTitle>This session is {session.status}</AlertTitle>
          <AlertDescription>
            <Link to="/sessions/$id" params={{ id }} className="underline">
              View summary
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Session</p>
          <h1 className="text-2xl font-semibold">
            {client ? `${client.first_name} ${client.last_name}` : "—"}
            {service ? ` · ${service.name}` : ""}
          </h1>
        </div>
        <Badge variant="secondary" className="capitalize">{session.status}</Badge>
      </header>

      {flagged ? (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Contraindications flagged during intake</AlertTitle>
          <AlertDescription>
            Confirm the client remains suitable before starting.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div
          className="rounded-xl border p-6"
          style={{
            background: freq?.color ? `linear-gradient(135deg, ${freq.color}22, transparent 70%)` : undefined,
            borderColor: freq?.color ?? undefined,
          }}
        >
          {freq ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Frequency</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-6xl font-bold tabular-nums" style={{ color: freq.color ?? undefined }}>
                  {freq.hz}
                </span>
                <span className="text-lg text-muted-foreground">Hz</span>
              </div>
              <p className="mt-2 text-xl font-medium">{freq.name}</p>
              {freq.description ? (
                <p className="mt-3 text-sm text-muted-foreground">{freq.description}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No frequency selected.</p>
          )}
        </div>

        <div className="flex items-center justify-center rounded-xl border bg-card p-8">
          <CountdownTimer durationSeconds={durationSeconds} />
        </div>
      </div>

      {audio && signed?.url ? (
        <AudioPlayer src={signed.url} title={audio.title} />
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
          <Music className="h-5 w-5 text-muted-foreground" />
          <span>No audio uploaded for this frequency yet — </span>
          <Link to="/audio" className="underline">add one under Audio</Link>
        </div>
      )}

      <CompletePanel
        sessionId={session.id}
        defaultAmount={Number(service?.price ?? 0)}
        defaultNotes={session.practitioner_notes}
      />
    </div>
  );
}
