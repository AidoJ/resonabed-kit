import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Music, X } from "lucide-react";
import {
  getAudioForFrequency,
  getSignedAudioUrl,
  listFrequenciesWithAudioFlag,
} from "@/lib/sessions.functions";
import {
  HOME_DURATION_PRESETS,
  HOME_SAFETY_CHECK_LEAD,
  HOME_SAFETY_GENERAL,
  HOME_SAFETY_HEADING,
  HOME_SAFETY_INTRO,
  HOME_SAFETY_POINTS,
  HOME_SESSION_REMINDER,
} from "@/lib/home-safety";
import {
  computeTargetHz,
  rankFrequencies,
  type FrequencyRow,
} from "@/lib/frequency-match";
import { WizardShell } from "@/components/session-wizard/wizard-shell";
import {
  StepSymptoms,
  DEFAULT_SYMPTOMS,
  toIntakeInputs,
  type SymptomsState,
} from "@/components/session-wizard/step-symptoms";
import { StepFrequency } from "@/components/session-wizard/step-frequency";
import { CountdownTimer } from "@/components/session-player/countdown-timer";
import {
  AudioPlayer,
  playWhenReady,
  type AudioPlayerHandle,
} from "@/components/session-player/audio-player";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sessions/personal")({
  head: () => ({
    meta: [
      { title: "Personal session, ResonaBed" },
      {
        name: "description",
        content: "Run a personal vibroacoustic session, just like the home experience.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PersonalSession,
});

const STEP_TITLES = ["Reminder", "Length", "Symptoms", "Frequency"] as const;

const SUBTITLES = [
  "A short safety note before you settle in.",
  "How long do you have today?",
  "A quick snapshot of how you feel right now.",
  "Your suggested frequency, change it if you prefer.",
];

function PersonalSession() {
  const navigate = useNavigate();
  const libraryFn = useServerFn(listFrequenciesWithAudioFlag);

  const [step, setStep] = useState(0);
  const [minutes, setMinutes] = useState<number>(30);
  const [symptoms, setSymptoms] = useState<SymptomsState>({ ...DEFAULT_SYMPTOMS });
  const [chosenFreqId, setChosenFreqId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["personal-library"],
    queryFn: () => libraryFn(),
  });

  const frequencies = useMemo(() => (data ?? []) as FrequencyRow[], [data]);
  const hasAudio = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const f of data ?? []) m[f.id] = f.has_audio;
    return m;
  }, [data]);

  const intake = useMemo(() => toIntakeInputs(symptoms), [symptoms]);
  const targetHz = useMemo(() => computeTargetHz(intake, frequencies), [intake, frequencies]);
  const ranked = useMemo(
    () => (frequencies.length ? rankFrequencies(frequencies, intake) : []),
    [frequencies, intake],
  );

  const defaultFreqId = useMemo(() => {
    const withAudio = ranked.find((r) => hasAudio[r.frequency.id]);
    return (withAudio ?? ranked[0])?.frequency.id ?? null;
  }, [ranked, hasAudio]);

  const activeFreqId = chosenFreqId ?? defaultFreqId;
  const chosen = ranked.find((r) => r.frequency.id === activeFreqId)?.frequency ?? null;

  const exit = () => navigate({ to: "/sessions" });

  if (playing && chosen) {
    return <PersonalPlayer minutes={minutes} frequency={chosen} onExit={exit} />;
  }

  const canProceed = (() => {
    if (step === 0) return agreed;
    if (step === 1) return !!minutes;
    if (step === 2) return true;
    if (step === 3) return !!activeFreqId;
    return false;
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personal session</h1>
        <p className="text-sm text-muted-foreground">
          The same session a home user runs, for yourself. Nothing is recorded.
        </p>
      </div>

      <WizardShell
        step={step}
        totalSteps={STEP_TITLES.length}
        stepLabels={STEP_TITLES}
        title={STEP_TITLES[step]!}
        subtitle={SUBTITLES[step]}
        footer={
          <>
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() => (step === 0 ? exit() : setStep((s) => s - 1))}
            >
              Back
            </Button>
            {step < STEP_TITLES.length - 1 ? (
              <Button
                size="lg"
                className="h-12"
                disabled={!canProceed}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-12"
                disabled={!canProceed}
                onClick={() => setPlaying(true)}
              >
                Start session
              </Button>
            )}
          </>
        }
      >
        {step === 0 && <SafetyStep agreed={agreed} onAgreedChange={setAgreed} />}

        {step === 1 && (
          <div>
            <Label className="mb-3 block">Session length</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HOME_DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={cn(
                    "h-16 rounded-xl border text-base transition-colors",
                    minutes === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted",
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && <StepSymptoms value={symptoms} onChange={setSymptoms} />}

        {step === 3 &&
          (isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your sound library…
            </p>
          ) : ranked.length ? (
            <StepFrequency
              ranked={ranked}
              hasAudio={hasAudio}
              targetHz={targetHz}
              selectedId={activeFreqId}
              onChange={setChosenFreqId}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Your sound library is not available right now.
            </p>
          ))}
      </WizardShell>

      <p className="text-center text-xs text-muted-foreground">
        Personal sessions are never recorded. Nothing you choose here is saved.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function SafetyStep({
  agreed,
  onAgreedChange,
}: {
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium">{HOME_SAFETY_HEADING}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{HOME_SAFETY_INTRO}</p>
      </div>

      <div className="rounded-2xl border bg-card/60 p-5">
        <p className="text-sm font-medium">{HOME_SAFETY_CHECK_LEAD}</p>
        <ul className="mt-3 space-y-2">
          {HOME_SAFETY_POINTS.map((p) => (
            <li key={p} className="flex gap-3 text-sm">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-2 border-t pt-4">
          {HOME_SAFETY_GENERAL.map((p) => (
            <li key={p} className="flex gap-3 text-sm text-muted-foreground">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">{HOME_SESSION_REMINDER}</p>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
        />
        <span>I have read this</span>
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function PersonalPlayer({
  minutes,
  frequency,
  onExit,
}: {
  minutes: number;
  frequency: FrequencyRow;
  onExit: () => void;
}) {
  const audioFn = useServerFn(getAudioForFrequency);
  const signFn = useServerFn(getSignedAudioUrl);
  const audioHandleRef = useRef<AudioPlayerHandle | null>(null);
  const [ambient, setAmbient] = useState(false);

  const { data: audio } = useQuery({
    queryKey: ["personal-audio", frequency.id],
    queryFn: () => audioFn({ data: { frequency_id: frequency.id } }),
  });

  const { data: signed } = useQuery({
    queryKey: ["personal-audio-url", audio?.id],
    queryFn: () => signFn({ data: { audio_file_id: audio!.id } }),
    enabled: !!audio?.id && !audio.locked,
    // Never swap the track URL mid-session (that would restart playback).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // If Start is tapped before the signed URL (and player) is ready, the play
  // call lands on a null ref and is lost. Replay once the track is available
  // while the timer is running, so the music always joins the session.
  useEffect(() => {
    if (ambient && signed?.url && audioHandleRef.current) {
      audioHandleRef.current.play();
    }
  }, [ambient, signed?.url]);

  return (
    <div className="play-dark fixed inset-0 z-[60] overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Personal session · {frequency.hz} Hz · {frequency.name}
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
              onStart={() => (signed?.url ? playWhenReady(audioHandleRef) : undefined)}
              onPause={() => audioHandleRef.current?.pause()}
              onReset={() => audioHandleRef.current?.stop()}
              onRunningChange={setAmbient}
              onFadeStart={(s) => audioHandleRef.current?.fadeOut(Math.max(3, s))}
              onComplete={() => {
                // The fade stops playback itself, this is only a safety net so
                // a looping track can never run past the end of the session.
                window.setTimeout(() => audioHandleRef.current?.stop(), 2600);
              }}
            />
          </div>

          <div className="w-full">
            {audio && !audio.locked && signed?.url ? (
              <AudioPlayer
                ref={audioHandleRef}
                src={signed.url}
                title={audio.title}
                onPlayingChange={setAmbient}
                hideTransport
                loop
              />
            ) : audio?.locked ? (
              <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground/90">
                <Music className="h-5 w-5" />
                <span>
                  Music licence expired, the global track for this frequency is locked. Contact
                  ResonaBed to renew, or upload your own audio under{" "}
                  <Link to="/audio" className="underline">
                    Audio
                  </Link>
                  .
                </span>
              </div>
            ) : audio === null ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-muted-foreground">
                <Music className="h-5 w-5" />
                <span>
                  No audio uploaded for this frequency yet,{" "}
                  <Link to="/audio" className="underline">
                    add one under Audio
                  </Link>
                </span>
              </div>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your track…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
