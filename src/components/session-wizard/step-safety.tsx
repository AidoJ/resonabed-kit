import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, ShieldCheck, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getScreeningContext } from "@/lib/screening.functions";
import {
  SCREENING_CHECKLIST,
  SCREENING_ATTESTATION_TEXT,
  isClearableItem,
} from "@/lib/screening-checklist";
import { ClearanceLetterDialog } from "@/components/screening/clearance-letter-dialog";
import { SignaturePad } from "./signature-pad";

export interface SafetyState {
  contraindications: string[];
  noneApply: boolean;
  /** "Anything else I should know about your health today?" — null = unanswered. */
  otherHealth: boolean | null;
  /** Details captured when otherHealth is yes. */
  otherHealthDetails: string;
  notes: string;
  consentGiven: boolean;
  signature: string | null;
  practitionerSignature: string | null;
}

interface Props {
  value: SafetyState;
  onChange: (s: SafetyState) => void;
  clientId: string;
  /** Reports which ticked items currently block the session (no valid clearance). */
  onBlockingChange?: (items: string[]) => void;
}

type PolicyKey = "consent" | "health" | "privacy";

const POLICY_LABELS: Record<PolicyKey, string> = {
  consent: "Consent",
  health: "Health & safety",
  privacy: "Privacy",
};

export function StepSafety({ value, onChange, clientId, onBlockingChange }: Props) {
  const ctxFn = useServerFn(getScreeningContext);
  const { data: ctx, refetch } = useQuery({
    queryKey: ["screening-context", clientId],
    queryFn: () => ctxFn({ data: { client_id: clientId } }),
    enabled: !!clientId,
  });

  const [open, setOpen] = useState<PolicyKey | null>(null);
  const [letterItem, setLetterItem] = useState<string | null>(null);
  const [read, setRead] = useState<Record<PolicyKey, boolean>>({
    consent: false,
    health: false,
    privacy: false,
  });

  const org = ctx?.org;
  const bodyFor = (k: PolicyKey) =>
    k === "consent"
      ? org?.consent_text
      : k === "health"
        ? org?.health_policy_text
        : org?.privacy_policy_text;

  const clearedItems = ctx?.cleared_items ?? [];

  const toggle = (v: string) => {
    const has = value.contraindications.includes(v);
    onChange({
      ...value,
      noneApply: false,
      contraindications: has
        ? value.contraindications.filter((x) => x !== v)
        : [...value.contraindications, v],
    });
  };

  const setNone = (checked: boolean) => {
    onChange({
      ...value,
      noneApply: checked,
      contraindications: checked ? [] : value.contraindications,
    });
  };

  const flagged = value.contraindications;
  const blocking = flagged.filter((i) => !isClearableItem(i) || !clearedItems.includes(i));

  const blockingKey = blocking.join("|");
  useEffect(() => {
    onBlockingChange?.(blockingKey ? blockingKey.split("|") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockingKey]);

  const answered = value.noneApply || flagged.length > 0;


  return (
    <div className="space-y-6">
      {ctx?.prior_screening ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Returning client</AlertTitle>
          <AlertDescription>
            Last screened {new Date(ctx.prior_screening.created_at).toLocaleDateString()}. Confirm
            the answers again, any change requires a fresh, fully signed screening.
          </AlertDescription>
        </Alert>
      ) : null}

      <div>
        <Label className="mb-3 block">Safety screening, tick anything that applies</Label>
        <div className="space-y-3 rounded-md border p-4">
          {SCREENING_CHECKLIST.map((o) => {
            const ticked = flagged.includes(o.key);
            const cleared = ticked && o.clearable && clearedItems.includes(o.key);
            return (
              <div key={o.key} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={ticked}
                    onCheckedChange={() => toggle(o.key)}
                    className="h-5 w-5"
                  />
                  <span>{o.label}</span>
                </label>
                {ticked ? (
                  cleared ? (
                    <Badge variant="secondary" className="shrink-0">
                      Cleared by letter
                    </Badge>
                  ) : o.clearable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setLetterItem(o.key)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Clearance letter
                    </Button>
                  ) : (
                    <Badge variant="destructive" className="shrink-0">
                      Cannot be cleared
                    </Badge>
                  )
                ) : null}
              </div>
            );
          })}
          <div className="mt-2 border-t pt-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={value.noneApply}
                onCheckedChange={(c) => setNone(c === true)}
                className="h-5 w-5"
              />
              <span>None of these apply, recorded as a signed attestation</span>
            </label>
            {!answered && (
              <p className="text-muted-foreground mt-2 text-xs">
                An answer is required: tick every item that applies, or tick “None of these apply”.
                Leaving everything blank is not a valid screening.
              </p>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium">
              Before we start, is there anything else I should know about your health today?
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={value.otherHealth === true ? "default" : "outline"}
                onClick={() => onChange({ ...value, otherHealth: true })}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={value.otherHealth === false ? "default" : "outline"}
                onClick={() =>
                  onChange({ ...value, otherHealth: false, otherHealthDetails: "" })
                }
              >
                No
              </Button>
            </div>
            {value.otherHealth === true ? (
              <Textarea
                className="mt-3"
                rows={3}
                value={value.otherHealthDetails}
                onChange={(e) => onChange({ ...value, otherHealthDetails: e.target.value })}
                placeholder="Add the details here, recorded with this screening"
                autoFocus
              />
            ) : null}
            {value.otherHealth === null && (
              <p className="text-muted-foreground mt-2 text-xs">
                Please answer yes or no before signing.
              </p>
            )}
          </div>
        </div>
      </div>

      {blocking.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>This session cannot proceed</AlertTitle>
          <AlertDescription>
            {blocking
              .map((b) => SCREENING_CHECKLIST.find((i) => i.key === b)?.label ?? b)
              .join(", ")}{" "}
            {blocking.length === 1 ? "is" : "are"} flagged without valid clearance. The screening
            must still be completed and signed by both parties, signing records an auditable
            refusal (a cancelled session) instead of starting one.
          </AlertDescription>
        </Alert>
      ) : null}


      <div>
        <Label className="mb-2 block">Practitioner notes (optional)</Label>
        <Textarea
          rows={4}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Anything to record before the session begins"
        />
      </div>

      {/* Policy acceptance + signatures */}
      <div className="space-y-4 rounded-md border p-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={value.consentGiven}
            onCheckedChange={(c) => onChange({ ...value, consentGiven: c === true })}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            I have read and accept the Consent, Health &amp; Safety and Privacy policies
            {org?.name ? ` of ${org.name}` : ""}.
          </span>
        </label>

        <p className="text-muted-foreground text-xs">{SCREENING_ATTESTATION_TEXT}</p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(POLICY_LABELS) as PolicyKey[]).map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(k);
                setRead((r) => ({ ...r, [k]: true }));
              }}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              {POLICY_LABELS[k]}, Read now
              {read[k] ? " ✓" : ""}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 border-t pt-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block">Client signature</Label>
            <SignaturePad
              value={value.signature}
              onChange={(sig) => onChange({ ...value, signature: sig })}
            />
          </div>
          <div>
            <Label className="mb-2 block">Practitioner countersignature</Label>
            <SignaturePad
              value={value.practitionerSignature}
              onChange={(sig) => onChange({ ...value, practitionerSignature: sig })}
            />
          </div>
        </div>
      </div>

      {letterItem && ctx?.org?.id ? (
        <ClearanceLetterDialog
          open={!!letterItem}
          onOpenChange={(o) => !o && setLetterItem(null)}
          clientId={clientId}
          orgId={ctx.org.id}
          itemKey={letterItem}
          letters={ctx.letters ?? []}
          onChanged={() => refetch()}
        />
      ) : null}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open ? POLICY_LABELS[open] : ""} policy</DialogTitle>
            <DialogDescription>
              {org?.name ?? "Your clinic"}, please read this with your client.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {(open ? bodyFor(open) : null)?.trim() ||
                "This policy has not been set up yet. Ask your organisation admin to complete it in Settings."}
            </p>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
