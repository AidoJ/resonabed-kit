import { useState } from "react";
import { AlertTriangle, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CONTRAINDICATION_OPTIONS } from "@/lib/frequency-match";
import { getMyOrgPolicies } from "@/lib/policy-templates.functions";
import { SignaturePad } from "./signature-pad";

export interface SafetyState {
  contraindications: string[];
  noneApply: boolean;
  notes: string;
  consentGiven: boolean;
  signature: string | null;
}

interface Props {
  value: SafetyState;
  onChange: (s: SafetyState) => void;
}

type PolicyKey = "consent" | "health" | "privacy";

const POLICY_LABELS: Record<PolicyKey, string> = {
  consent: "Consent",
  health: "Health & safety",
  privacy: "Privacy",
};

export function StepSafety({ value, onChange }: Props) {
  const policiesFn = useServerFn(getMyOrgPolicies);
  const { data: policies } = useQuery({
    queryKey: ["my-org-policies"],
    queryFn: () => policiesFn(),
  });
  const [open, setOpen] = useState<PolicyKey | null>(null);
  const [read, setRead] = useState<Record<PolicyKey, boolean>>({
    consent: false,
    health: false,
    privacy: false,
  });

  const bodyFor = (k: PolicyKey) =>
    k === "consent"
      ? policies?.consent_text
      : k === "health"
        ? policies?.health_policy_text
        : policies?.privacy_policy_text;

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

  const flagged = value.contraindications.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-3 block">Safety screening — tick anything that applies</Label>
        <div className="space-y-3 rounded-md border p-4">
          {CONTRAINDICATION_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={value.contraindications.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
                className="h-5 w-5"
              />
              <span>{o.label}</span>
            </label>
          ))}
          <div className="mt-2 border-t pt-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={value.noneApply}
                onCheckedChange={(c) => setNone(c === true)}
                className="h-5 w-5"
              />
              <span>None of these apply</span>
            </label>
          </div>
        </div>
      </div>

      {flagged ? (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Please assess suitability before proceeding</AlertTitle>
          <AlertDescription>
            One or more items were flagged. Use your professional judgement to decide whether to
            continue with this session or refer the client for further advice.
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

      {/* Policy acceptance */}
      <div className="space-y-4 rounded-md border p-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={value.consentGiven}
            onCheckedChange={(c) => onChange({ ...value, consentGiven: c === true })}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            I have read and accept the Consent, Health &amp; Safety and Privacy policies
            {policies?.org_name ? ` of ${policies.org_name}` : ""}.
          </span>
        </label>

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
              {POLICY_LABELS[k]} — Read now
              {read[k] ? " ✓" : ""}
            </Button>
          ))}
        </div>

        <div className="border-t pt-4">
          <Label className="mb-2 block">Client signature</Label>
          <SignaturePad
            value={value.signature}
            onChange={(sig) => onChange({ ...value, signature: sig })}
          />
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open ? POLICY_LABELS[open] : ""} policy</DialogTitle>
            <DialogDescription>
              {policies?.org_name ?? "Your clinic"} — please read this with your client.
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
