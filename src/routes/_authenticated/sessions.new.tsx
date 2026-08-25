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
import {
  StepSymptoms,
  DEFAULT_SYMPTOMS,
  toIntakeInputs,
  type SymptomsState,
} from "@/components/session-wizard/step-symptoms";
import { saveSessionCheckin } from "@/lib/checkins.functions";
import { StepSafety, type SafetyState } from "@/components/session-wizard/step-safety";
import { StepFrequency } from "@/components/session-wizard/step-frequency";
import {
  createDraftSession,
  listFrequenciesWithAudioFlag,
} from "@/lib/sessions.functions";
import { submitScreening, declineSessionForScreening } from "@/lib/screening.functions";
import { SCREENING_CHECKLIST } from "@/lib/screening-checklist";
import { getBooking, startSessionFromBooking } from "@/lib/bookings.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { computeTargetHz, rankFrequencies } from "@/lib/frequency-match";
import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const searchSchema = z.object({
  booking_id: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/sessions/new")({
  head: () => ({ meta: [{ title: "New session, ResonaBed" }] }),
  validateSearch: zodValidator(searchSchema),
  component: NewSession,
});

const STEP_TITLES = ["Client", "Service", "Wellbeing Check", "Safety", "Frequency"];

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

  const isConfigured = ctx?.org?.isConfigured ?? true;
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

  const [symptoms, setSymptoms] = useState<SymptomsState>({ ...DEFAULT_SYMPTOMS });
  const [safety, setSafety] = useState<SafetyState>({
    contraindications: [],
    noneApply: false,
    otherHealth: null,
    otherHealthDetails: "",
    notes: "",
    consentGiven: false,
    signature: null,
    practitionerSignature: null,
  });
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [blockingNow, setBlockingNow] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<{ items: string[] } | null>(null);
  const [screeningBusy, setScreeningBusy] = useState(false);
  const [chosenFreqId, setChosenFreqId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const freqFn = useServerFn(listFrequenciesWithAudioFlag);
  const { data: freqs } = useQuery({ queryKey: ["frequencies-with-audio"], queryFn: () => freqFn() });

  // The six right-positive wellbeing scales are converted once, pain and
  // stress invert here so the matcher keeps its historical semantics.
  const intake = useMemo(() => toIntakeInputs(symptoms), [symptoms]);

  const targetHz = useMemo(() => computeTargetHz(intake, freqs ?? []), [intake, freqs]);

  const ranked = useMemo(() => {
    if (!freqs) return [];
    return rankFrequencies(freqs, intake);
  }, [freqs, intake]);

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
  const saveCheckinFn = useServerFn(saveSessionCheckin);
  const startFromBookingFn = useServerFn(startSessionFromBooking);
  const navigate = useNavigate();

  const canProceed = (() => {
    if (step === 0) return !!client;
    if (step === 1) return !!service;
    if (step === 2) return true;
    if (step === 3)
      return (
        safety.consentGiven &&
        !!safety.signature &&
        !!safety.practitionerSignature &&
        (safety.noneApply || safety.contraindications.length > 0) &&
        safety.otherHealth !== null
      );
    if (step === 4) return !!activeFreqId;
    return false;
  })();

  const submitScreeningFn = useServerFn(submitScreening);
  const declineFn = useServerFn(declineSessionForScreening);

  // The client's "anything else about your health" details are folded into the
  // practitioner notes so they persist with the signed screening record.
  const combinedNotes = (() => {
    const parts: string[] = [];
    if (safety.otherHealth && safety.otherHealthDetails.trim()) {
      parts.push(`Client flagged additional health info: ${safety.otherHealthDetails.trim()}`);
    }
    if (safety.notes.trim()) parts.push(safety.notes.trim());
    return parts.join("\n\n") || undefined;
  })();

  /**
   * The screening is signed and stored BEFORE any session row exists, the
   * session then references it. A blocked outcome never creates a session.
   */
  const handleScreeningNext = async () => {
    if (!client) return;
    setScreeningBusy(true);
    try {
      const res = await submitScreeningFn({
        data: {
          client_id: client.id,
          booking_id: booking_id ?? null,
          none_apply: safety.noneApply,
          flagged_items: safety.contraindications,
          practitioner_notes: combinedNotes,
          client_signature: safety.signature!,
          practitioner_signature: safety.practitionerSignature!,
          is_reattestation: false,
        },
      });
      setScreeningId(res.id);
      if (res.outcome === "blocked") {
        setBlocked({ items: res.blocking_items ?? [] });
        return;
      }
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the screening");
    } finally {
      setScreeningBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!screeningId) return;
    setScreeningBusy(true);
    try {
      await declineFn({
        data: {
          screening_id: screeningId,
          service_id: service?.id ?? null,
          booking_id: booking_id ?? null,
          notes: combinedNotes,
        },
      });
      toast.success("Refusal recorded, session cancelled and logged");
      navigate({ to: "/sessions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the refusal");
    } finally {
      setScreeningBusy(false);
    }
  };

  const handleFinish = async () => {
    if (!client || !service || !activeFreqId || !screeningId) return;
    setSubmitting(true);
    try {
      const intakeNow = toIntakeInputs(symptoms);
      const payload = {
        pain_level: intakeNow.painLevel,
        stress_level: intakeNow.stressLevel,
        sleep_quality: intakeNow.sleepQuality,
        body_areas: symptoms.bodyAreas,
        primary_goals: symptoms.goals,
        health_concerns: [],
        contraindications: safety.contraindications,
        practitioner_notes: combinedNotes,
        consent_given: true as const,
        client_signature: safety.signature ?? undefined,
        recommended_frequency_id: activeFreqId,
        screening_id: screeningId,
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
      // The wizard's Wellbeing Check doubles as the "before" check-in, saved
      // in right-positive scale semantics. A failure here must not block the
      // session, the player screen still offers the check-in.
      try {
        await saveCheckinFn({
          data: {
            session_id: sessionId,
            phase: "before",
            ratings: {
              pain: symptoms.pain,
              physical_ease: symptoms.physicalEase,
              sleep_quality: symptoms.sleep,
              arousal: symptoms.stress,
              mood: symptoms.mood,
              relaxation: symptoms.relaxation,
            },
          },
        });
      } catch {
        toast.info("Session created, but the wellbeing check could not be saved");
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
    "Slide each scale to where the client feels right now, red is hardest, green is best.",
    "Screen for contraindications, then both parties sign. This record is permanent.",
    "Suggested frequency for this intake, override if you prefer.",
  ];

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Setup not complete</h2>
            <p className="text-sm">
              Sessions are blocked until your organisation admin has completed the clinic setup,
              business identity, logo, consent wording, privacy policy, and health &amp; safety
              policy, and signed the go-live acknowledgement.
            </p>
            {isAdmin ? (
              <Button asChild>
                <Link to="/admin/settings">Go to settings</Link>
              </Button>
            ) : (
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                Please contact your organisation admin to complete setup.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              variant={step === 3 && blockingNow.length > 0 ? "destructive" : "default"}
              disabled={!canProceed || screeningBusy}
              onClick={() => (step === 3 ? handleScreeningNext() : setStep((s) => s + 1))}
            >
              {step === 3
                ? screeningBusy
                  ? "Signing…"
                  : blockingNow.length > 0
                    ? "Sign & record refusal"
                    : "Sign & continue"
                : "Next"}
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
      {step === 3 && client && (
        <StepSafety
          value={safety}
          onChange={(next) => {
            // Any edit invalidates a previously signed screening, it must be
            // re-signed rather than silently reused.
            setSafety(next);
            setScreeningId(null);
          }}
          clientId={client.id}
          onBlockingChange={setBlockingNow}
        />
      )}
      {step === 4 && (
        <StepFrequency
          ranked={ranked}
          hasAudio={hasAudio}
          targetHz={targetHz}
          selectedId={activeFreqId}
          onChange={setChosenFreqId}
        />

      )}

      <Dialog open={!!blocked} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Session blocked by screening</DialogTitle>
            <DialogDescription>
              The signed screening flagged{" "}
              {(blocked?.items ?? [])
                .map((b) => SCREENING_CHECKLIST.find((i) => i.key === b)?.label ?? b)
                .join(", ")}{" "}
              without valid clearance. The screening has been recorded and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Recording the refusal writes a cancelled session linked to this screening so the
            decision is auditable.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate({ to: "/sessions" })}>
              Leave without recording
            </Button>
            <Button variant="destructive" disabled={screeningBusy} onClick={handleDecline}>
              Record refusal &amp; cancel session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardShell>
  );
}
