import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  updateOrgSettings,
  getSignedLogoUrl,
  getOrgSettings,
  completeOrgSetup,
  listPolicyAudit,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Admin — ResonaBed" }] }),
  component: SettingsAdmin,
});

const POLICY_HELPER =
  "This is your clinic's legal wording. You are the responsible party. Review with your own insurer or legal advisor. Resonabed stores and displays what you enter and does not review it for legal sufficiency.";

function SettingsAdmin() {
  const fetchSettings = useServerFn(getOrgSettings);
  const saveOrg = useServerFn(updateOrgSettings);
  const signLogo = useServerFn(getSignedLogoUrl);
  const completeSetup = useServerFn(completeOrgSetup);
  const fetchAudit = useServerFn(listPolicyAudit);
  const qc = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => fetchSettings(),
  });
  const { data: audit } = useQuery({
    queryKey: ["org-policy-audit"],
    queryFn: () => fetchAudit(),
    enabled: !!org,
  });

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [abn, setAbn] = useState("");
  const [brand, setBrand] = useState("#884bc7");
  const [consent, setConsent] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [health, setHealth] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [ackName, setAckName] = useState("");
  const [ackChecked, setAckChecked] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setBusinessName(org.business_name ?? "");
    setContactEmail(org.contact_email ?? "");
    setAbn(org.abn ?? "");
    setBrand(org.brand_color ?? "#884bc7");
    setConsent(org.consent_text ?? "");
    setPrivacy(org.privacy_policy_text ?? "");
    setHealth(org.health_policy_text ?? "");
  }, [org]);

  useEffect(() => {
    (async () => {
      if (org?.logo_path) {
        try {
          const { url } = await signLogo({ data: { path: org.logo_path } });
          setLogoPreview(url);
        } catch {
          setLogoPreview(null);
        }
      } else {
        setLogoPreview(null);
      }
    })();
  }, [org?.logo_path, signLogo]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!businessName.trim()) m.push("Business name");
    if (!contactEmail.trim()) m.push("Contact email");
    if (!org?.logo_path) m.push("Logo");
    if (!consent.trim()) m.push("Consent wording");
    if (!privacy.trim()) m.push("Privacy policy");
    if (!health.trim()) m.push("Health & safety policy");
    return m;
  }, [businessName, contactEmail, org?.logo_path, consent, privacy, health]);

  const canGoLive = missing.length === 0 && !org?.is_configured;

  const save = async (
    payload: Parameters<typeof saveOrg>[0] extends { data: infer D } ? D : never,
    successMsg = "Saved",
  ) => {
    try {
      await saveOrg({ data: payload });
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
      qc.invalidateQueries({ queryKey: ["org-policy-audit"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onUploadLogo = async (file: File) => {
    if (!org?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${org.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      await save({ logo_path: path }, "Logo updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onAcknowledge = async () => {
    setAcking(true);
    try {
      await completeSetup({
        data: { acknowledger_name: ackName, acknowledged: true },
      });
      toast.success("Setup complete — your clinic is live.");
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAcking(false);
    }
  };

  if (isLoading || !org) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Go-live status banner */}
      {org.is_configured ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Clinic is live</p>
            <p className="text-emerald-800/80 dark:text-emerald-100/80">
              Acknowledged by <strong>{org.configured_acknowledgement_by}</strong> on{" "}
              {new Date(org.configured_acknowledgement_at!).toLocaleString()}. This record is
              immutable.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Setup mode — sessions are blocked</p>
            <p className="text-amber-800/80 dark:text-amber-100/80">
              Complete the required fields below, then sign the acknowledgement to go live.
              Practitioners can log in but cannot create sessions until setup is complete.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: forms */}
        <div className="space-y-6 lg:col-span-2">
          {/* Business identity */}
          <Card>
            <CardHeader>
              <CardTitle>Business identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Business (trading) name</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div>
                  <Label>Organisation name (internal)</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Contact email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>ABN / business number (optional)</Label>
                  <Input value={abn} onChange={(e) => setAbn(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Brand colour (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="font-mono"
                  />
                  <div
                    className="h-10 w-10 rounded-md border"
                    style={{ backgroundColor: brand }}
                    aria-label="Brand colour preview"
                  />
                </div>
              </div>

              <div>
                <Label>Logo</Label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-h-24 rounded border bg-white p-2"
                    />
                  ) : (
                    <div className="flex h-24 w-40 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadLogo(f);
                    }}
                    className="max-w-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    save({
                      name,
                      business_name: businessName || null,
                      contact_email: contactEmail || null,
                      abn: abn || null,
                      brand_color: brand,
                    })
                  }
                >
                  Save identity
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBrand("#884bc7");
                    save({ brand_color: null }, "Brand colour reset");
                  }}
                >
                  Reset brand colour
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Client-facing policies */}
          <Card>
            <CardHeader>
              <CardTitle>Client-facing policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PolicyField
                label="Consent wording"
                value={consent}
                onChange={setConsent}
                helper={POLICY_HELPER}
                rows={6}
              />
              <PolicyField
                label="Privacy policy"
                value={privacy}
                onChange={setPrivacy}
                helper={POLICY_HELPER}
                rows={8}
              />
              <PolicyField
                label="Health & safety policy"
                value={health}
                onChange={setHealth}
                helper={POLICY_HELPER}
                rows={8}
              />
              <Button
                onClick={() =>
                  save(
                    {
                      consent_text: consent,
                      privacy_policy_text: privacy,
                      health_policy_text: health,
                    },
                    "Policies saved",
                  )
                }
              >
                Save policies
              </Button>
            </CardContent>
          </Card>

          {/* Go-live gate */}
          {!org.is_configured && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Acknowledge & go live
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {missing.length > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="mb-1 font-medium">Still required:</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Save the sections above so these values are recorded before you acknowledge.
                    </p>
                  </div>
                )}

                <div className="rounded-md border bg-background p-4 text-sm leading-relaxed">
                  <p>
                    By ticking below and typing my name, I confirm that the business details and
                    the consent, privacy and health &amp; safety wording entered here are accurate
                    and legally appropriate for my clinic. I am the responsible party for this
                    content. I understand that <strong>Resonabed provides the software only</strong>{" "}
                    and is not responsible for the content or legal sufficiency of what I have
                    entered.
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="ack"
                    checked={ackChecked}
                    onCheckedChange={(v) => setAckChecked(Boolean(v))}
                    disabled={missing.length > 0}
                  />
                  <Label htmlFor="ack" className="text-sm font-normal">
                    I have read and agree to the acknowledgement above.
                  </Label>
                </div>

                <div>
                  <Label>Type your full name to sign</Label>
                  <Input
                    value={ackName}
                    onChange={(e) => setAckName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    disabled={missing.length > 0}
                  />
                </div>

                <Button
                  disabled={!canGoLive || !ackChecked || ackName.trim().length < 2 || acking}
                  onClick={onAcknowledge}
                >
                  {acking ? "Recording…" : "Acknowledge & go live"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Policy audit log */}
          {audit && audit.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Policy change log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {audit.slice(0, 20).map((row) => (
                  <div key={row.id} className="flex flex-wrap gap-2 border-b pb-2 last:border-0">
                    <Badge variant="outline">{row.field}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      by {row.edited_by_name ?? row.edited_by}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: live preview */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: brand }}
              >
                <div className="flex items-center gap-3">
                  {logoPreview && (
                    <img src={logoPreview} alt="" className="h-10 w-auto" />
                  )}
                  <div>
                    <p className="font-semibold" style={{ color: brand }}>
                      {businessName || name || "Your clinic"}
                    </p>
                    <p className="text-xs text-muted-foreground">{contactEmail}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Client consent (as shown in the wizard)
                </p>
                <div className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                  {consent || <span className="text-muted-foreground">No consent wording yet.</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PolicyField({
  label,
  value,
  onChange,
  helper,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper: string;
  rows: number;
}) {
  const isSample = value.trim().startsWith("SAMPLE");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {isSample && (
          <Badge variant="outline" className="text-amber-700 border-amber-400">
            Sample — replace before go-live
          </Badge>
        )}
      </div>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
