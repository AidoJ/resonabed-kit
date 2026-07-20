import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Music, X } from "lucide-react";
import { getSession, getAudioForFrequency, getSignedAudioUrl } from "@/lib/sessions.functions";
import { getMyOrgLicence } from "@/lib/licence.functions";
import { CountdownTimer } from "@/components/session-player/countdown-timer";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/session-player/audio-player";
import { CompletePanel } from "@/components/session-player/complete-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sessions/$id/play")({
  head: () => ({ meta: [{ title: "Session — ResonaBed" }] }),
  component: PlaySession,
});

function PlaySession() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSession);
  const audioFn = useServerFn(getAudioForFrequency);
  const signFn = useServerFn(getSignedAudioUrl);
  const licenceFn = useServerFn(getMyOrgLicence);
  const { data: licence } = useQuery({
    queryKey: ["my-org-licence"],
    queryFn: () => licenceFn(),
  });

  const [ambient, setAmbient] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const audioHandleRef = useRef<AudioPlayerHandle | null>(null);

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

  // If the timer was started before the audio finished loading, kick off
  // playback as soon as the signed URL is ready.
  useEffect(() => {
    if (timerRunning && signed?.url && audioHandleRef.current) {
      audioHandleRef.current.play();
    }
  }, [timerRunning, signed?.url]);


  if (isLoading || !session)
    return (
      <div className="play-dark fixed inset-0 z-[60] grid place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );

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

  const ringTint = freq?.color ?? "hsl(268 55% 55%)";

  return (
    <div
      className="play-dark fixed inset-0 z-[60] overflow-y-auto bg-background text-foreground"
      style={
        {
          background:
            "radial-gradient(ellipse at 50% -10%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), radial-gradient(ellipse at 50% 110%, color-mix(in oklab, var(--brand-indigo) 30%, transparent), transparent 60%), var(--background)",
        } as React.CSSProperties
      }
    >
      {/* Ambient pulse rings behind timer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "absolute left-1/2 top-1/2 block h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
              ambient ? "animate-pulse-ring" : "opacity-20",
            )}
            style={{
              borderColor: `color-mix(in oklab, ${ringTint} 55%, transparent)`,
              animationDelay: ambient ? `${i * 1.4}s` : undefined,
            }}
          />
        ))}
      </div>

      {/* Close */}
      <div className="relative flex items-center justify-between px-6 pt-5 sm:px-10">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Session</p>
          <h1 className="mt-1 truncate text-[20px] font-light text-foreground">
            {client ? `${client.first_name} ${client.last_name}` : "—"}
            {service ? ` · ${service.name}` : ""}
          </h1>
        </div>
        <Button asChild variant="ghost" className="h-11 rounded-full text-foreground/80 hover:bg-white/5">
          <Link to="/sessions">
            <X className="mr-2 h-4 w-4" />
            Exit
          </Link>
        </Button>
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 pb-16 pt-8 sm:px-10">
        {flagged ? (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Contraindications flagged during intake</AlertTitle>
            <AlertDescription>
              Confirm the client remains suitable before starting.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Frequency badge */}
        {freq ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Frequency
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[72px] font-extralight tabular-nums leading-none"
                style={{ color: ringTint }}
              >
                {freq.hz}
              </span>
              <span className="text-xl font-light text-muted-foreground">Hz</span>
            </div>
            <p className="text-[15px] font-medium tracking-wide text-foreground/90">{freq.name}</p>
            {freq.description ? (
              <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
                {freq.description}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Timer */}
        <CountdownTimer
          durationSeconds={durationSeconds}
          onRunningChange={(r) => {
            setAmbient(r);
            setTimerRunning(r);
          }}
          onStart={() => {
            setTimerRunning(true);
            audioHandleRef.current?.play();
          }}
          onPause={() => {
            setTimerRunning(false);
            audioHandleRef.current?.pause();
          }}
          onReset={() => {
            setTimerRunning(false);
            audioHandleRef.current?.stop();
          }}
        />


        {/* Audio */}
        <div className="w-full max-w-2xl">
          {audio && signed?.url ? (
            <AudioPlayer
              ref={audioHandleRef}
              src={signed.url}
              title={audio.title}
              onPlayingChange={setAmbient}
            />
          ) : licence && !licence.is_ok ? (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground/90">
              <Music className="h-5 w-5" />
              <span>
                Music licence expired — the global track for this frequency is locked. Contact
                ResonaBed to renew, or upload your own audio under{" "}
                <Link to="/audio" className="underline">
                  Audio
                </Link>
                .
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-muted-foreground">
              <Music className="h-5 w-5" />
              <span>No audio uploaded for this frequency yet — </span>
              <Link to="/audio" className="underline">
                add one under Audio
              </Link>
            </div>
          )}
        </div>

        {/* Complete panel */}
        <div className="w-full max-w-2xl">
          <CompletePanel
            sessionId={session.id}
            defaultAmount={Number(service?.price ?? 0)}
            defaultNotes={session.practitioner_notes}
          />
        </div>
      </div>
    </div>
  );
}
