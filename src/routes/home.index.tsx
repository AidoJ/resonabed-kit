import { useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, X } from "lucide-react";
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
  HOME_SAFETY_CHECK_LEAD,
  HOME_SAFETY_GENERAL,
  HOME_SAFETY_HEADING,
  HOME_SAFETY_INTRO,
  HOME_SAFETY_POINTS,
  HOME_SAFETY_VERSION,
  HOME_SESSION_REMINDER,
} from "@/lib/home-safety";
import {
  computeTargetHz,
  rankFrequencies,
  type FrequencyRow,
} from "@/lib/frequency-match";
import { WizardShell } from "@/components/session-wizard/wizard-shell";
import { StepSymptoms, type SymptomsState } from "@/components/session-wizard/step-symptoms";
import { StepFrequency } from "@/components/session-wizard/step-frequency";
import { SignaturePad } from "@/components/session-wizard/signature-pad";
import { CountdownTimer } from "@/components/session-player/countdown-timer";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/session-player/audio-player";
import { Button } from "@/components/ui/button";
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
  return <HomeWizard displayName={home.displayName} acknowledged={home.acknowledged} />;
}

/* ---------------------------------------------------------------- */

function Shell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <img src={logo.url} alt="Resonabed" className="h-9 w-auto" />
          {onSignOut ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

const STEP_TITLES = ["Reminder", "Length", "Symptoms", "Frequency"] as const;

const SUBTITLES = [
  "A short safety note before you settle in.",
  "How long do you have today?",
  "A quick snapshot of how you feel right now.",
  "Your suggested frequency, change it if you prefer.",
];

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function HomeWizard({
  displayName,
  acknowledged,
}: {
  displayName: string | null;
  acknowledged: boolean;
}) {
  const router = useRouter();
  const libraryFn = useServerFn(listHomeLibrary);
  const ackFn = useServerFn(acknowledgeHomeSafety);

  const [step, setStep] = useState(0);
  const [minutes, setMinutes] = useState<number>(30);
  const [symptoms, setSymptoms] = useState<SymptomsState>({
    painLevel: 3,
    stressLevel: 5,
    sleepQuality: 5,
    bodyAreas: [],
    goals: [],
  });
  const [chosenFreqId, setChosenFreqId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // First run: drawn signature + attestation. Afterwards: a tick box only.
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  const ackMutation = useMutation({
    mutationFn: () => ackFn({ data: { signature: signature! } }),
    onSuccess: async () => {
      await router.invalidate();
      setStep(1);
    },
    onError: (e) => setAckError(e instanceof Error ? e.message : "Please try again."),
  });

  const { data } = useQuery({ queryKey: ["home-library"], queryFn: () => libraryFn() });

  const frequencies = useMemo(
    () => (data?.frequencies ?? []) as FrequencyRow[],
    [data?.frequencies],
  );
  const tracks = useMemo(() => data?.tracks ?? [], [data?.tracks]);

  const hasAudio = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const f of frequencies) m[f.id] = tracks.some((t) => t.frequency_id === f.id);
    return m;
  }, [frequencies, tracks]);

  const targetHz = useMemo(
    () => computeTargetHz(symptoms, frequencies),
    [symptoms, frequencies],
  );

  const ranked = useMemo(
    () => (frequencies.length ? rankFrequencies(frequencies, symptoms) : []),
    [frequencies, symptoms],
  );

  const defaultFreqId = useMemo(() => {
    const withAudio = ranked.find((r) => hasAudio[r.frequency.id]);
    return (withAudio ?? ranked[0])?.frequency.id ?? null;
  }, [ranked, hasAudio]);

  const activeFreqId = chosenFreqId ?? defaultFreqId;
  const chosen = ranked.find((r) => r.frequency.id === activeFreqId)?.frequency ?? null;
  const track = chosen ? (tracks.find((t) => t.frequency_id === chosen.id) ?? null) : null;

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/home/login");
  };

  // End of a session returns to a clean start: nothing is carried over.
  const endSession = () => {
    setPlaying(false);
    setStep(0);
    setAgreed(false);
    setChosenFreqId(null);
    setMinutes(30);
    setSymptoms({
      painLevel: 3,
      stressLevel: 5,
      sleepQuality: 5,
      bodyAreas: [],
      goals: [],
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  if (playing && chosen) {
    return (
      <HomePlayer
        minutes={minutes}
        frequency={chosen}
        trackId={track?.id ?? null}
        trackTitle={track?.title ?? `${chosen.hz} Hz`}
        onExit={endSession}
      />
    );
  }

  const canProceed = (() => {
    if (step === 0)
      return acknowledged ? agreed : agreed && !!signature && !ackMutation.isPending;
    if (step === 1) return !!minutes;
    if (step === 2) return true;
    if (step === 3) return !!activeFreqId;
    return false;
  })();

  const handleNext = () => {
    if (step === 0 && !acknowledged) {
      setAckError(null);
      ackMutation.mutate();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <Shell onSignOut={signOut}>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">
          {displayName ? `Hello ${displayName.split(" ")[0]}` : "Hello"}
        </h1>
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
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < STEP_TITLES.length - 1 ? (
              <Button size="lg" className="h-12" disabled={!canProceed} onClick={handleNext}>
                {ackMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {step === 0 && !acknowledged ? "Agree and continue" : "Next"}
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
        {step === 0 && (
          <SafetyStep
            firstRun={!acknowledged}
            agreed={agreed}
            onAgreedChange={setAgreed}
            signature={signature}
            onSignatureChange={setSignature}
            error={ackError}
          />
        )}

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
          (ranked.length ? (
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

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Sessions are never recorded. Nothing you choose here is saved.
      </p>
    </Shell>
  );
}

/* ---------------------------------------------------------------- */

function SafetyStep({
  firstRun,
  agreed,
  onAgreedChange,
  signature,
  onSignatureChange,
  error,
}: {
  firstRun: boolean;
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  signature: string | null;
  onSignatureChange: (v: string | null) => void;
  error: string | null;
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

      {!firstRun ? (
        <p className="text-sm text-muted-foreground">{HOME_SESSION_REMINDER}</p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
        />
        <span>{firstRun ? HOME_SAFETY_ATTESTATION : "I have read this"}</span>
      </label>

      {firstRun ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label>Sign to confirm</Label>
            <span className="text-xs text-muted-foreground">{todayLabel()}</span>
          </div>
          <SignaturePad
            value={signature}
            onChange={onSignatureChange}
            helperText="Sign with your finger, stylus or mouse."
          />
          <p className="text-xs text-muted-foreground">
            We record only that you accepted this notice ({HOME_SAFETY_VERSION}), the date and your
            signature. We do not ask for, or keep, any health information about you.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
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
              <AudioPlayer
                ref={audioHandleRef}
                src={signed.url}
                title={trackTitle}
                hideTransport
              />

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
