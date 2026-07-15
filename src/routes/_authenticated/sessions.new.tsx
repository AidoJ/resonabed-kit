import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { WizardShell } from "@/components/session-wizard/wizard-shell";
import { StepClient, type ClientOption } from "@/components/session-wizard/step-client";
import { StepService, type ServiceOption } from "@/components/session-wizard/step-service";
import { StepSymptoms, type SymptomsState } from "@/components/session-wizard/step-symptoms";
import { StepSafety, type SafetyState } from "@/components/session-wizard/step-safety";
import { StepFrequency } from "@/components/session-wizard/step-frequency";
import {
  createDraftSession,
  listFrequenciesWithAudioFlag,
} from "@/lib/sessions.functions";
import { getBooking, startSessionFromBooking } from "@/lib/bookings.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { computeTargetHz, rankFrequencies } from "@/lib/frequency-match";
import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  booking_id: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/sessions/new")({
  head: () => ({ meta: [{ title: "New session — ResonaBed" }] }),
  validateSearch: zodValidator(searchSchema),
  component: NewSession,
});

const STEP_TITLES = ["Client", "Service", "Symptoms", "Safety", "Frequency"];

function NewSession() {
  const { booking_id } = Route.useSearch();
  const bookingFn = useServerFn(getBooking);
  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  const { data: booking } = useQuery({
    queryKey: ["booking", booking_id],
    queryFn: () => bookingFn({ data: { id: booking_id! } }),
    enabled: !!booking_id,
  });

  const isConfigured = ctx?.isConfigured ?? true;
  const isAdmin =
    ctx?.roles?.includes("super_admin") || ctx?.roles?.includes("org_admin");

  const [step, setStep] = useState(0);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [service, setService] = useState<ServiceOption | null>(null);

  // Pre-fill from booking and jump to Symptoms step.
  useEffect(() => {
    if (!booking) return;
    if (booking.client) {
      setClient({
        id: booking.client.id,
        first_name: booking.client.first_name,
        last_name: booking.client.last_name,
      } as ClientOption);
    }
    if (booking.service) {
      setService({
        id: booking.service.id,
        name: booking.service.name,
        duration_minutes: booking.service.duration_minutes,
      } as ServiceOption);
    }
    setStep((s) => (s < 2 ? 2 : s));
  }, [booking]);

  const [symptoms, setSymptoms] = useState<SymptomsState>({
    painLevel: 3,
    stressLevel: 5,
    sleepQuality: 5,
    bodyAreas: [],
    goals: [],
  });
  const [safety, setSafety] = useState<SafetyState>({
    contraindications: [],
    noneApply: false,
    notes: "",
    consentGiven: false,
  });
  const [chosenFreqId, setChosenFreqId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const freqFn = useServerFn(listFrequenciesWithAudioFlag);
  const { data: freqs } = useQuery({ queryKey: ["frequencies-with-audio"], queryFn: () => freqFn() });

  const targetHz = useMemo(() => computeTargetHz(symptoms, freqs ?? []), [symptoms, freqs]);

  const ranked = useMemo(() => {
    if (!freqs) return [];
    return rankFrequencies(freqs, symptoms);
  }, [freqs, symptoms]);

  const hasAudio = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const f of freqs ?? []) m[f.id] = f.has_audio;
    return m;
  }, [freqs]);

  // Default selection: top-ranked with audio, else top-ranked overall.
  const defaultFreqId = useMemo(() => {
    const withAudio = ranked.find((r) => hasAudio[r.frequency.id]);
    return (withAudio ?? ranked[0])?.frequency.id ?? null;
  }, [ranked, hasAudio]);

  const activeFreqId = chosenFreqId ?? defaultFreqId;
  const createFn = useServerFn(createDraftSession);
  const startFromBookingFn = useServerFn(startSessionFromBooking);
  const navigate = useNavigate();

  const canProceed = (() => {
    if (step === 0) return !!client;
    if (step === 1) return !!service;
    if (step === 2) return true;
    if (step === 3) return safety.consentGiven && (safety.noneApply || safety.contraindications.length >= 0);
    if (step === 4) return !!activeFreqId;
    return false;
  })();

  const handleFinish = async () => {
    if (!client || !service || !activeFreqId) return;
    setSubmitting(true);
    try {
      const payload = {
        pain_level: symptoms.painLevel,
        stress_level: symptoms.stressLevel,
        sleep_quality: symptoms.sleepQuality,
        body_areas: symptoms.bodyAreas,
        primary_goals: symptoms.goals,
        health_concerns: [],
        contraindications: safety.contraindications,
        practitioner_notes: safety.notes || undefined,
        consent_given: true as const,
        recommended_frequency_id: activeFreqId,
      };
      let sessionId: string;
      if (booking_id) {
        const res = await startFromBookingFn({
          data: { booking_id, ...payload },
        });
        sessionId = res.session_id;
      } else {
        const res = await createFn({
          data: { client_id: client.id, service_id: service.id, ...payload },
        });
        sessionId = res.id;
      }
      toast.success("Session created");
      navigate({ to: "/sessions/$id/play", params: { id: sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setSubmitting(false);
    }
  };

  const subtitles = [
    "Pick an existing client or add a new one.",
    "Choose the service being delivered.",
    "Quick snapshot of how the client feels right now.",
    "Screen for contraindications and confirm consent.",
    "Suggested frequency for this intake — override if you prefer.",
  ];

  return (
    <WizardShell
      step={step}
      totalSteps={STEP_TITLES.length}
      stepLabels={STEP_TITLES}
      title={STEP_TITLES[step]}
      subtitle={subtitles[step]}
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
              disabled={!canProceed || submitting}
              onClick={handleFinish}
            >
              {submitting ? "Saving…" : "Start session"}
            </Button>
          )}
        </>
      }
    >
      {step === 0 && <StepClient value={client} onChange={setClient} />}
      {step === 1 && <StepService value={service} onChange={setService} />}
      {step === 2 && <StepSymptoms value={symptoms} onChange={setSymptoms} />}
      {step === 3 && <StepSafety value={safety} onChange={setSafety} />}
      {step === 4 && (
        <StepFrequency
          ranked={ranked}
          hasAudio={hasAudio}
          targetHz={targetHz}
          selectedId={activeFreqId}
          onChange={setChosenFreqId}
        />

      )}
    </WizardShell>
  );
}
