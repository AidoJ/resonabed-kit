import { useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, LogOut, Music, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getHomeContext,
  acknowledgeHomeSafety,
  listHomeLibrary,
  getHomeAudioUrl,
} from "@/lib/home.functions";
import {
  HOME_DURATION_PRESETS,
  HOME_SAFETY_ATTESTATION,
  HOME_SAFETY_HEADING,
  HOME_SAFETY_INTRO,
  HOME_SAFETY_POINTS,
  HOME_SESSION_REMINDER,
} from "@/lib/home-safety";
import {
  GOAL_OPTIONS,
  rankFrequencies,
  type IntakeGoal,
  type FrequencyRow,
} from "@/lib/frequency-match";
import { CountdownTimer } from "@/components/session-player/countdown-timer";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/session-player/audio-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/home/")({
  head: () => ({
    meta: [
      { title: "Your Resonabed" },
      { name: "description", content: "Start a Resonabed session at home." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/home/login" });
    const ctx = await getHomeContext();
    // A clinic login must never land in the personal app.
    if (ctx.kind !== "home") throw redirect({ to: "/dashboard" });
    return { home: ctx };
  },
  component: HomeApp,
});

function HomeApp() {
  const { home } = Route.useRouteContext();
  if (!home.acknowledged) return <SafetyAcknowledgement />;
  return <HomeMain displayName={home.displayName} />;
}

/* ---------------------------------------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <img src={logo.url} alt="Resonabed" className="mx-auto mb-10 h-10 w-auto" />
        {children}
      </div>
    </div>
  );
}

function SafetyAcknowledgement() {
  const router = useRouter();
  const ack = useServerFn(acknowledgeHomeSafety);
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => ack({ data: { signature: signature.trim() } }),
    onSuccess: () => router.invalidate(),
    onError: (e) => setError(e instanceof Error ? e.message : "Please try again."),
  });

  return (
    <Shell>
      <h1 className="text-2xl font-medium">{HOME_SAFETY_HEADING}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{HOME_SAFETY_INTRO}</p>

      <ul className="mt-6 space-y-3 rounded-2xl border bg-card/60 p-5">
        {HOME_SAFETY_POINTS.map((p) => (
          <li key={p} className="flex gap-3 text-sm">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-muted-foreground">
        We record only that you accepted this notice, along with the date and your signature. We do
        not ask for, or keep, any health information about you.
      </p>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
        />
        <span>{HOME_SAFETY_ATTESTATION}</span>
      </label>

      <div className="mt-5">
        <Label htmlFor="signature">Type your full name to sign</Label>
        <Input
          id="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          className="mt-1.5"
          placeholder="Your full name"
        />
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <Button
        className="mt-6 h-12 w-full"
        disabled={!agreed || signature.trim().length < 2 || mutation.isPending}
        onClick={() => {
          setError(null);
          mutation.mutate();
        }}
      >
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Agree and continue
      </Button>
    </Shell>
  );
}

/* ---------------------------------------------------------------- */

function HomeMain({ displayName }: { displayName: string | null }) {
  const libraryFn = useServerFn(listHomeLibrary);
  const [goals, setGoals] = useState<IntakeGoal[]>(["relaxation"]);
  const [minutes, setMinutes] = useState<number>(30);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRead, setReminderRead] = useState(false);
  const [playing, setPlaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["home-library"],
    queryFn: () => libraryFn(),
  });

  const frequencies = useMemo(
    () => (data?.frequencies ?? []) as FrequencyRow[],
    [data?.frequencies],
  );
  const tracks = useMemo(() => data?.tracks ?? [], [data?.tracks]);

  const chosen = useMemo(() => {
    if (frequencies.length === 0) return null;
    const ranked = rankFrequencies(frequencies, {
      painLevel: 5,
      stressLevel: 5,
      sleepQuality: 5,
      bodyAreas: [],
      goals: goals.length ? goals : (["relaxation"] as IntakeGoal[]),
    });
    // Prefer the closest match that actually has a track to play.
    const withAudio = ranked.find((r) => tracks.some((t) => t.frequency_id === r.frequency.id));
    return (withAudio ?? ranked[0])?.frequency ?? null;
  }, [frequencies, tracks, goals]);

  const track = chosen ? (tracks.find((t) => t.frequency_id === chosen.id) ?? null) : null;

  const toggleGoal = (g: IntakeGoal) =>
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  if (playing && chosen) {
    return (
      <HomePlayer
        minutes={minutes}
        frequency={chosen}
        trackId={track?.id ?? null}
        trackTitle={track?.title ?? `${chosen.hz} Hz`}
        onExit={() => {
          setPlaying(false);
          setReminderOpen(false);
          setReminderRead(false);
        }}
      />
    );
  }

  return (
    <Shell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">
            {displayName ? `Hello ${displayName.split(" ")[0]}` : "Hello"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick how you would like to feel, and how long you have.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.assign("/home/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      <section className="mt-9">
        <Label className="mb-3 block">How would you like to feel?</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((o) => {
            const active = goals.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleGoal(o.value)}
                className={cn(
                  "h-11 rounded-full border px-5 text-sm transition-colors",
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
      </section>

      <section className="mt-8">
        <Label className="mb-3 block">Session length</Label>
        <div className="grid grid-cols-4 gap-2">
          {HOME_DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={cn(
                "h-14 rounded-xl border text-base transition-colors",
                minutes === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted",
              )}
            >
              {m} min
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-card/60 p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your library…</p>
        ) : chosen ? (
          <>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Your session
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className="text-4xl font-semibold tabular-nums"
                style={{ color: chosen.color ?? undefined }}
              >
                {chosen.hz}
              </span>
              <span className="text-muted-foreground">Hz</span>
              <span className="text-lg">{chosen.name}</span>
            </div>
            {chosen.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{chosen.description}</p>
            ) : null}
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Music className="h-3.5 w-3.5" />
              {track ? track.title : "No track available for this frequency yet"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your sound library is not available right now.
          </p>
        )}
      </section>

      <Button
        className="mt-7 h-14 w-full text-base"
        disabled={!chosen}
        onClick={() => setReminderOpen(true)}
      >
        Start session
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Sessions are never recorded. Nothing you choose here is saved.
      </p>

      {reminderOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-medium">Before you settle in</h2>
            <p className="mt-3 text-sm text-muted-foreground">{HOME_SESSION_REMINDER}</p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={reminderRead}
                onChange={(e) => setReminderRead(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <span>I have read this</span>
            </label>
            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setReminderOpen(false);
                  setReminderRead(false);
                }}
              >
                Not now
              </Button>
              <Button className="flex-1" disabled={!reminderRead} onClick={() => setPlaying(true)}>
                <Check className="mr-2 h-4 w-4" />
                Begin
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

/* ---------------------------------------------------------------- */

function HomePlayer({
  minutes,
  frequency,
  trackId,
  trackTitle,
  onExit,
}: {
  minutes: number;
  frequency: FrequencyRow;
  trackId: string | null;
  trackTitle: string;
  onExit: () => void;
}) {
  const urlFn = useServerFn(getHomeAudioUrl);
  const audioHandleRef = useRef<AudioPlayerHandle | null>(null);
  const [ambient, setAmbient] = useState(false);

  const { data: signed } = useQuery({
    queryKey: ["home-audio-url", trackId],
    queryFn: () => urlFn({ data: { id: trackId! } }),
    enabled: !!trackId,
  });

  return (
    <div className="play-dark fixed inset-0 z-[60] overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {frequency.hz} Hz · {frequency.name}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">
            <X className="mr-2 h-4 w-4" />
            End
          </Button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10">
          <div className="relative">
            {ambient ? (
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-10"
                style={{ background: frequency.color ?? "var(--primary)" }}
              />
            ) : null}
            <CountdownTimer
              durationSeconds={minutes * 60}
              onStart={() => audioHandleRef.current?.play()}
              onPause={() => audioHandleRef.current?.pause()}
              onReset={() => audioHandleRef.current?.stop()}
              onRunningChange={setAmbient}
              onFadeStart={(s) => audioHandleRef.current?.fadeOut(Math.max(3, s))}
            />
          </div>

          <div className="w-full">
            {signed?.url ? (
              <AudioPlayer ref={audioHandleRef} src={signed.url} title={trackTitle} />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {trackId ? "Preparing your sound…" : "No track available for this frequency yet."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
