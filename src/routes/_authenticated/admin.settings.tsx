import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  updateOrgSettings,
  getSignedLogoUrl,
  getOrgSettings,
  completeOrgSetup,
  listPolicyAudit,
} from "@/lib/admin.functions";
import { listPolicyTemplates } from "@/lib/policy-templates.functions";
import { getMyOrgLicence } from "@/lib/licence.functions";
import {
  listSupportAccessForOrg,
  grantSupportAccess,
  revokeSupportAccess,
  listSupportSessionsHistory,
} from "@/lib/support-access.functions";

import {
  DEFAULT_THEME,
  contrastRatio,
  extractPalette,
  isHex6,
  textOn,
} from "@/lib/theme-colors";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

// Text colour used on top of sidebar/primary. Matches what the shell renders.
const SIDEBAR_TEXT_FALLBACK = "#ffffff";
const PRIMARY_TEXT_FALLBACK = "#ffffff";

// WCAG AA for normal text ≈ 4.5. We warn below 4.0 as a "readable enough" threshold.
const MIN_CONTRAST = 4.0;

function SettingsAdmin() {
  const fetchSettings = useServerFn(getOrgSettings);
  const saveOrg = useServerFn(updateOrgSettings);
  const signLogo = useServerFn(getSignedLogoUrl);
  const completeSetup = useServerFn(completeOrgSetup);
  const fetchAudit = useServerFn(listPolicyAudit);
  const fetchTemplates = useServerFn(listPolicyTemplates);
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
  const { data: templates } = useQuery({
    queryKey: ["policy-templates"],
    queryFn: () => fetchTemplates(),
  });
  const fetchLicence = useServerFn(getMyOrgLicence);
  const { data: licence } = useQuery({
    queryKey: ["my-org-licence"],
    queryFn: () => fetchLicence(),
  });

  const tplBody = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templates ?? []) m[t.kind] = t.body;
    return m;
  }, [templates]);

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [abn, setAbn] = useState("");
  const [themePrimary, setThemePrimary] = useState<string>(DEFAULT_THEME.primary);
  const [themeSidebar, setThemeSidebar] = useState<string>(DEFAULT_THEME.sidebar);
  const [themeAccent, setThemeAccent] = useState<string>(DEFAULT_THEME.accent);
  const [suggestedSwatches, setSuggestedSwatches] = useState<string[]>([]);
  const [consent, setConsent] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [health, setHealth] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [permManageClients, setPermManageClients] = useState(true);
  const [permViewAllClients, setPermViewAllClients] = useState(true);
  const [permManageBookings, setPermManageBookings] = useState(true);
  const [permCompleteUnpaid, setPermCompleteUnpaid] = useState(true);

  type SectionKey = "identity" | "theme" | "policies" | "permissions";
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savedAt, setSavedAt] = useState<Record<SectionKey, number | null>>({
    identity: null,
    theme: null,
    policies: null,
    permissions: null,
  });

  const [ackName, setAckName] = useState("");
  const [ackChecked, setAckChecked] = useState(false);
  const [ackSignature, setAckSignature] = useState<string | null>(null);

  const [acking, setAcking] = useState(false);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setBusinessName(org.business_name ?? "");
    setContactEmail(org.contact_email ?? "");
    setAbn(org.abn ?? "");
    setThemePrimary(
      isHex6(org.theme_primary)
        ? org.theme_primary
        : isHex6(org.brand_color)
          ? org.brand_color
          : DEFAULT_THEME.primary,
    );
    setThemeSidebar(isHex6(org.theme_sidebar) ? org.theme_sidebar : DEFAULT_THEME.sidebar);
    setThemeAccent(isHex6(org.theme_accent) ? org.theme_accent : DEFAULT_THEME.accent);
    setConsent(org.consent_text ?? "");
    setPrivacy(org.privacy_policy_text ?? "");
    setHealth(org.health_policy_text ?? "");
    setPermManageClients(org.practitioners_can_manage_clients ?? true);
    setPermViewAllClients(org.practitioners_can_view_all_clients ?? true);
    setPermManageBookings(org.practitioners_can_manage_bookings ?? true);
    setPermCompleteUnpaid(org.practitioners_can_complete_unpaid ?? true);
  }, [org]);

  useEffect(() => {
    (async () => {
      if (org?.logo_path) {
        try {
          const { url } = await signLogo({ data: { path: org.logo_path } });
          setLogoPreview(url);
          // Extract palette once logo url is available.
          try {
            const palette = await extractPalette(url, 6);
            setSuggestedSwatches(palette);
          } catch {
            /* ignore extraction errors */
          }
        } catch {
          setLogoPreview(null);
          setSuggestedSwatches([]);
        }
      } else {
        setLogoPreview(null);
        setSuggestedSwatches([]);
      }
    })();
  }, [org?.logo_path, signLogo]);

  // A policy field is "unedited" when it exactly matches the shipped sample
  // template body. Clinics must alter the wording (however slightly) before
  // saving so they explicitly own the final text.
  const consentUnedited = !!tplBody.consent && consent.trim() === tplBody.consent.trim();
  const privacyUnedited = !!tplBody.privacy && privacy.trim() === tplBody.privacy.trim();
  const healthUnedited =
    !!tplBody.health_safety && health.trim() === tplBody.health_safety.trim();
  const anyPolicyUnedited = consentUnedited || privacyUnedited || healthUnedited;

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!businessName.trim()) m.push("Business name");
    if (!contactEmail.trim()) m.push("Contact email");
    if (!org?.logo_path) m.push("Logo");
    if (!consent.trim()) m.push("Consent wording");
    if (!privacy.trim()) m.push("Privacy policy");
    if (!health.trim()) m.push("Health & safety policy");
    if (consentUnedited) m.push("Consent wording — edit the sample to make it yours");
    if (privacyUnedited) m.push("Privacy policy — edit the sample to make it yours");
    if (healthUnedited) m.push("Health & safety policy — edit the sample to make it yours");
    return m;
  }, [
    businessName,
    contactEmail,
    org?.logo_path,
    consent,
    privacy,
    health,
    consentUnedited,
    privacyUnedited,
    healthUnedited,
  ]);

  const canGoLive = missing.length === 0 && !org?.is_configured;

  // Dirty detection per section — compares live form state against loaded org.
  const identityDirty = !!org && (
    name !== org.name ||
    (businessName || "") !== (org.business_name ?? "") ||
    (contactEmail || "") !== (org.contact_email ?? "") ||
    (abn || "") !== (org.abn ?? "")
  );
  const themeDirty = !!org && (
    themePrimary !== (isHex6(org.theme_primary) ? org.theme_primary : isHex6(org.brand_color) ? org.brand_color : DEFAULT_THEME.primary) ||
    themeSidebar !== (isHex6(org.theme_sidebar) ? org.theme_sidebar : DEFAULT_THEME.sidebar) ||
    themeAccent !== (isHex6(org.theme_accent) ? org.theme_accent : DEFAULT_THEME.accent)
  );
  const policiesDirty = !!org && (
    (consent || "") !== (org.consent_text ?? "") ||
    (privacy || "") !== (org.privacy_policy_text ?? "") ||
    (health || "") !== (org.health_policy_text ?? "")
  );
  const permissionsDirty = !!org && (
    permManageClients !== (org.practitioners_can_manage_clients ?? true) ||
    permViewAllClients !== (org.practitioners_can_view_all_clients ?? true) ||
    permManageBookings !== (org.practitioners_can_manage_bookings ?? true) ||
    permCompleteUnpaid !== (org.practitioners_can_complete_unpaid ?? true)
  );

  const primaryContrast = contrastRatio(themePrimary, PRIMARY_TEXT_FALLBACK);
  const sidebarContrast = contrastRatio(themeSidebar, SIDEBAR_TEXT_FALLBACK);
  const primaryReadable = primaryContrast >= MIN_CONTRAST;
  const sidebarReadable = sidebarContrast >= MIN_CONTRAST;
  const themeReadable = primaryReadable && sidebarReadable;

  type OrgPatch = {
    name?: string;
    business_name?: string | null;
    contact_email?: string | null;
    abn?: string | null;
    brand_color?: string | null;
    theme_primary?: string | null;
    theme_sidebar?: string | null;
    theme_accent?: string | null;
    logo_path?: string | null;
    consent_text?: string | null;
    privacy_policy_text?: string | null;
    health_policy_text?: string | null;
    practitioners_can_manage_clients?: boolean;
    practitioners_can_view_all_clients?: boolean;
    practitioners_can_manage_bookings?: boolean;
    practitioners_can_complete_unpaid?: boolean;
  };
  const save = async (payload: OrgPatch, successMsg = "Saved", section?: SectionKey) => {
    if (section) setSavingSection(section);
    try {
      await saveOrg({ data: payload as never });
      toast.success(successMsg);
      if (section) {
        setSavedAt((s) => ({ ...s, [section]: Date.now() }));
      }
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
      qc.invalidateQueries({ queryKey: ["org-policy-audit"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      if (section) setSavingSection((cur) => (cur === section ? null : cur));
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
      await save({ logo_path: path }, "Logo updated", "identity");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const saveTheme = () => {
    if (!themeReadable) {
      toast.error("Fix the contrast warning before saving your theme.");
      return;
    }
    save(
      {
        theme_primary: themePrimary,
        theme_sidebar: themeSidebar,
        theme_accent: themeAccent,
        brand_color: themePrimary,
      },
      "Theme saved",
      "theme",
    );
  };

  const resetTheme = () => {
    setThemePrimary(DEFAULT_THEME.primary);
    setThemeSidebar(DEFAULT_THEME.sidebar);
    setThemeAccent(DEFAULT_THEME.accent);
    save(
      { theme_primary: null, theme_sidebar: null, theme_accent: null },
      "Theme reset to Resonabed defaults",
    );
  };

  const onAcknowledge = async () => {
    if (!ackSignature) {
      toast.error("Please sign in the signature panel before going live.");
      return;
    }
    setAcking(true);
    try {
      await completeSetup({
        data: { acknowledger_name: ackName, acknowledged: true, signature: ackSignature },
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!org) {
    return (
      <Card>
        <CardHeader><CardTitle>No organisation selected</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Your account isn't attached to an organisation, so there are no clinic settings to edit here.</p>
          <p>Super admins can manage clinics from the Organisations page.</p>
        </CardContent>
      </Card>
    );
  }

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
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadLogo(f);
                    }}
                    className="max-w-xs"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  PNG, JPG or SVG. Displayed in the sidebar and on the sign-in page for your users.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  disabled={!identityDirty || savingSection === "identity"}
                  onClick={() =>
                    save(
                      {
                        name,
                        business_name: businessName || null,
                        contact_email: contactEmail || null,
                        abn: abn || null,
                      },
                      "Identity saved",
                      "identity",
                    )
                  }
                >
                  {savingSection === "identity" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  ) : identityDirty ? "Save identity" : "Saved"}
                </Button>
                <SaveStatus
                  dirty={identityDirty}
                  saving={savingSection === "identity"}
                  savedAt={savedAt.identity}
                />
              </div>
            </CardContent>
          </Card>

          {/* Colour theme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Colour theme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {suggestedSwatches.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Suggested from your logo</p>
                  <p className="text-xs text-muted-foreground">
                    Click a swatch to assign it to a role. These are suggestions, not applied
                    automatically.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestedSwatches.map((hex) => (
                      <SwatchButton
                        key={hex}
                        hex={hex}
                        onAssignPrimary={() => setThemePrimary(hex)}
                        onAssignSidebar={() => setThemeSidebar(hex)}
                        onAssignAccent={() => setThemeAccent(hex)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <ColourRoleField
                label="Primary"
                description="Buttons, active states, accents."
                value={themePrimary}
                onChange={setThemePrimary}
                swatches={suggestedSwatches}
                contrastAgainst={PRIMARY_TEXT_FALLBACK}
                minContrast={MIN_CONTRAST}
                textLabel="white text"
              />
              <ColourRoleField
                label="Sidebar"
                description="Sidebar background."
                value={themeSidebar}
                onChange={setThemeSidebar}
                swatches={suggestedSwatches}
                contrastAgainst={SIDEBAR_TEXT_FALLBACK}
                minContrast={MIN_CONTRAST}
                textLabel="white text"
              />
              <ColourRoleField
                label="Accent"
                description="Highlights, badges, subtle chips."
                value={themeAccent}
                onChange={setThemeAccent}
                swatches={suggestedSwatches}
                contrastAgainst={textOn(themeAccent)}
                minContrast={3.0}
                textLabel="its own foreground"
              />

              {!themeReadable && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {!primaryReadable && (
                      <>
                        Primary colour has low contrast against white text (
                        {primaryContrast.toFixed(2)}:1). Pick a darker shade.
                      </>
                    )}
                    {!primaryReadable && !sidebarReadable && <br />}
                    {!sidebarReadable && (
                      <>
                        Sidebar colour has low contrast against white text (
                        {sidebarContrast.toFixed(2)}:1). Pick a darker shade.
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={saveTheme}
                  disabled={!themeReadable || !themeDirty || savingSection === "theme"}
                >
                  {savingSection === "theme" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  ) : themeDirty ? "Save theme" : "Saved"}
                </Button>
                <Button variant="outline" onClick={resetTheme}>
                  Reset to Resonabed defaults
                </Button>
                <SaveStatus
                  dirty={themeDirty}
                  saving={savingSection === "theme"}
                  savedAt={savedAt.theme}
                />
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
                unedited={consentUnedited}
                template={tplBody.consent}
              />
              <PolicyField
                label="Privacy policy"
                value={privacy}
                onChange={setPrivacy}
                helper={POLICY_HELPER}
                rows={8}
                unedited={privacyUnedited}
                template={tplBody.privacy}
              />
              <PolicyField
                label="Health & safety policy"
                value={health}
                onChange={setHealth}
                helper={POLICY_HELPER}
                rows={8}
                unedited={healthUnedited}
                template={tplBody.health_safety}
              />
              {anyPolicyUnedited && (
                <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    One or more policies still contain the unedited sample wording.
                    You must make at least one change to each policy so that the
                    final text is <strong>yours</strong>. This ensures you have
                    actively reviewed and accepted legal responsibility for what
                    the clinic publishes to clients.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button
                  disabled={!policiesDirty || anyPolicyUnedited || savingSection === "policies"}
                  onClick={() =>
                    save(
                      {
                        consent_text: consent,
                        privacy_policy_text: privacy,
                        health_policy_text: health,
                      },
                      "Policies saved",
                      "policies",
                    )
                  }
                >
                  {savingSection === "policies" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  ) : policiesDirty ? "Save policies" : "Saved"}
                </Button>
                <SaveStatus
                  dirty={policiesDirty}
                  saving={savingSection === "policies"}
                  savedAt={savedAt.policies}
                />
              </div>

            </CardContent>
          </Card>

          {/* Practitioner permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Practitioner permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Control what practitioners in your clinic can do. Org admins and super admins
                always have full access. Session delivery is always available to practitioners —
                these toggles never block running a session.
              </p>
              <PermissionToggle
                label="Can create and edit clients"
                description="When off, practitioners can still choose a client for a session, but can't add or change client records."
                checked={permManageClients}
                onChange={setPermManageClients}
              />
              <PermissionToggle
                label="Can view the full client list"
                description="When off, practitioners must search for a specific client by name or email — they can't browse everyone."
                checked={permViewAllClients}
                onChange={setPermViewAllClients}
              />
              <PermissionToggle
                label="Can create and edit bookings"
                description="When off, practitioners can only run and start sessions from bookings that admins have already created."
                checked={permManageBookings}
                onChange={setPermManageBookings}
              />
              <PermissionToggle
                label="Can complete a session as unpaid or comp"
                description="When off, practitioners must record an actual payment (method and amount) to complete a session. Only admins can close a session as unpaid or comp."
                checked={permCompleteUnpaid}
                onChange={setPermCompleteUnpaid}
              />
              <div className="flex items-center gap-3 pt-2">
                <Button
                  disabled={!permissionsDirty || savingSection === "permissions"}
                  onClick={() =>
                    save(
                      {
                        practitioners_can_manage_clients: permManageClients,
                        practitioners_can_view_all_clients: permViewAllClients,
                        practitioners_can_manage_bookings: permManageBookings,
                        practitioners_can_complete_unpaid: permCompleteUnpaid,
                      },
                      "Permissions saved",
                      "permissions",
                    )
                  }
                >
                  {savingSection === "permissions" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  ) : permissionsDirty ? "Save permissions" : "Saved"}
                </Button>
                <SaveStatus
                  dirty={permissionsDirty}
                  saving={savingSection === "permissions"}
                  savedAt={savedAt.permissions}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resonabed support access */}
          <SupportAccessCard orgId={org.id} />




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

          {/* Music licence (read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Music licence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!licence ? (
                <p className="text-muted-foreground">Licence details unavailable.</p>
              ) : (() => {
                const expiresMs = licence.expires_at ? new Date(licence.expires_at).getTime() : 0;
                const daysLeft = expiresMs
                  ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 86_400_000))
                  : 0;
                const isExpired = licence.status === "expired" || !licence.is_ok;
                const tone = isExpired
                  ? "destructive"
                  : licence.status === "trial"
                    ? "secondary"
                    : "default";
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={tone as "default" | "secondary" | "destructive"}>
                        {isExpired ? "Expired" : licence.status === "trial" ? "Trial" : "Active"}
                      </Badge>
                      {licence.plan && licence.plan !== "none" ? (
                        <Badge variant="outline" className="uppercase">
                          {licence.plan}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Expiry
                        </p>
                        <p className="font-medium">
                          {licence.expires_at
                            ? new Date(licence.expires_at).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Days remaining
                        </p>
                        <p className="font-medium">{isExpired ? 0 : daysLeft}</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      To renew or extend your licence, contact Resonabed at{" "}
                      <a href="mailto:info@resonabed.com" className="underline">
                        info@resonabed.com
                      </a>
                      . Licence changes can only be made by Resonabed.
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>


        {/* RIGHT: live preview */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThemePreview
                primary={themePrimary}
                sidebar={themeSidebar}
                accent={themeAccent}
                logoUrl={logoPreview}
                orgName={businessName || name || "Your clinic"}
              />
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

function ThemePreview({
  primary,
  sidebar,
  accent,
  logoUrl,
  orgName,
}: {
  primary: string;
  sidebar: string;
  accent: string;
  logoUrl: string | null;
  orgName: string;
}) {
  const sidebarFg = textOn(sidebar);
  const primaryFg = textOn(primary);
  const accentFg = textOn(accent);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[110px_1fr]">
        {/* Mini sidebar */}
        <div
          className="flex flex-col gap-2 p-2"
          style={{ backgroundColor: sidebar, color: sidebarFg }}
        >
          <div className="flex h-12 items-center justify-center rounded-md bg-white/95 p-1">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-auto object-contain" />
            ) : (
              <span className="text-[10px] font-medium text-brand-indigo">Resonabed</span>
            )}
          </div>
          <div
            className="rounded-md px-2 py-1.5 text-[11px] font-medium"
            style={{ backgroundColor: `color-mix(in oklab, ${primary} 30%, transparent)` }}
          >
            Sessions
          </div>
          <div className="rounded-md px-2 py-1.5 text-[11px] opacity-80">Clients</div>
          <div className="rounded-md px-2 py-1.5 text-[11px] opacity-80">Bookings</div>
        </div>
        {/* Mini main */}
        <div className="space-y-2 bg-card p-3">
          <div className="text-[11px] font-medium text-foreground">{orgName}</div>
          <div className="rounded-md border p-2">
            <p className="text-[11px] font-medium">Today's session</p>
            <p className="text-[10px] text-muted-foreground">Alex J · 20 min</p>
            <div className="mt-2 flex gap-1.5">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: accent, color: accentFg }}
              >
                Sleep
              </span>
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: accent, color: accentFg }}
              >
                Calm
              </span>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-md py-1.5 text-[11px] font-medium"
            style={{ backgroundColor: primary, color: primaryFg }}
          >
            Start session
          </button>
        </div>
      </div>
    </div>
  );
}

function ColourRoleField({
  label,
  description,
  value,
  onChange,
  swatches,
  contrastAgainst,
  minContrast,
  textLabel,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  swatches: string[];
  contrastAgainst: string;
  minContrast: number;
  textLabel: string;
}) {
  const ratio = contrastRatio(value, contrastAgainst);
  const ok = ratio >= minContrast;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <Label className="text-sm">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span
          className={`text-[11px] ${ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}
        >
          {ratio.toFixed(2)}:1 vs {textLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 p-1"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
              style={{ backgroundColor: s }}
              title={`Use ${s} for ${label.toLowerCase()}`}
              aria-label={`Use ${s} for ${label}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SwatchButton({
  hex,
  onAssignPrimary,
  onAssignSidebar,
  onAssignAccent,
}: {
  hex: string;
  onAssignPrimary: () => void;
  onAssignSidebar: () => void;
  onAssignAccent: () => void;
}) {
  return (
    <div className="group relative">
      <div
        className="h-10 w-10 rounded-md border border-border shadow-sm"
        style={{ backgroundColor: hex }}
        title={hex}
      />
      <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden min-w-[130px] flex-col overflow-hidden rounded-md border bg-popover text-xs shadow-lg group-hover:pointer-events-auto group-hover:flex">
        <button
          type="button"
          onClick={onAssignPrimary}
          className="px-3 py-1.5 text-left hover:bg-muted"
        >
          Use as Primary
        </button>
        <button
          type="button"
          onClick={onAssignSidebar}
          className="px-3 py-1.5 text-left hover:bg-muted"
        >
          Use as Sidebar
        </button>
        <button
          type="button"
          onClick={onAssignAccent}
          className="px-3 py-1.5 text-left hover:bg-muted"
        >
          Use as Accent
        </button>
        <div className="border-t px-3 py-1 font-mono text-[10px] text-muted-foreground">{hex}</div>
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
  unedited,
  template,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper: string;
  rows: number;
  unedited?: boolean;
  template?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {unedited && (
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
            Unedited sample — you must change this
          </Badge>
        )}
      </div>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={unedited ? "border-amber-400 focus-visible:ring-amber-400" : undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{helper}</p>
        {template ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                value.trim() &&
                !window.confirm(
                  "Replace the current wording with the latest Resonabed sample template? Your existing text will be lost.",
                )
              )
                return;
              onChange(template);
            }}
          >
            {value.trim() ? "Replace with sample template" : "Insert sample template"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}


function SaveStatus({
  dirty,
  saving,
  savedAt,
}: {
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const i = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, [savedAt]);

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
        Unsaved changes
      </Badge>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        Saved {formatRelative(savedAt)}
      </span>
    );
  }
  return null;
}

function formatRelative(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

function PermissionToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SupportAccessCard({ orgId }: { orgId: string }) {
  const fetchAccess = useServerFn(listSupportAccessForOrg);
  const fetchHistory = useServerFn(listSupportSessionsHistory);
  const grantFn = useServerFn(grantSupportAccess);
  const revokeFn = useServerFn(revokeSupportAccess);
  const qc = useQueryClient();

  const { data: access } = useQuery({
    queryKey: ["support-access", orgId],
    queryFn: () => fetchAccess({ data: { org_id: orgId } }),
    refetchInterval: 60_000,
  });
  const { data: history } = useQuery({
    queryKey: ["support-history", orgId],
    queryFn: () => fetchHistory({ data: { org_id: orgId } }),
  });

  const [hours, setHours] = useState<24 | 48 | 72>(48);
  const [pending, setPending] = useState(false);
  const active = access?.active ?? null;

  const onGrant = async () => {
    setPending(true);
    try {
      await grantFn({ data: { hours } });
      toast.success(`Support access granted for ${hours} hours`);
      await qc.invalidateQueries({ queryKey: ["support-access", orgId] });
      await qc.invalidateQueries({ queryKey: ["support-history", orgId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const onRevoke = async () => {
    if (!active) return;
    setPending(true);
    try {
      await revokeFn({ data: { grant_id: active.id } });
      toast.success("Support access revoked");
      await qc.invalidateQueries({ queryKey: ["support-access", orgId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resonabed support access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          When Resonabed needs to view your clinic to investigate an issue, they must have your
          permission. Grant a time-limited window below. You can revoke it any time. Every entry
          is logged in the history so you can see exactly when and why access occurred.
        </p>

        {active ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="mb-1">Access granted</Badge>
                <p className="text-sm">
                  Active until{" "}
                  <strong>{new Date(active.expires_at).toLocaleString()}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Granted by {active.granted_by_name ?? active.granted_by} on{" "}
                  {new Date(active.granted_at).toLocaleString()}
                </p>
              </div>
              <Button variant="destructive" onClick={onRevoke} disabled={pending}>
                Revoke access
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border p-3">
            <Badge variant="secondary" className="mb-2">No active grant</Badge>
            <p className="mb-3 text-sm text-muted-foreground">
              Resonabed cannot access your clinic's data through the app without a grant.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Label>Duration</Label>
              <div className="flex gap-1">
                {([24, 48, 72] as const).map((h) => (
                  <Button
                    key={h}
                    size="sm"
                    variant={hours === h ? "default" : "outline"}
                    onClick={() => setHours(h)}
                  >
                    {h}h
                  </Button>
                ))}
              </div>
              <Button onClick={onGrant} disabled={pending}>
                {pending ? "Granting…" : `Grant support access`}
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Support access history
          </p>
          {!history || history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No support access has occurred yet.
            </p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 20).map((h) => (
                <div key={h.id} className="flex flex-wrap items-baseline gap-2 border-b pb-2 last:border-0">
                  {h.emergency ? (
                    <Badge variant="destructive">Emergency access</Badge>
                  ) : (
                    <Badge variant="outline">Granted access</Badge>
                  )}
                  <span className="text-xs">
                    {new Date(h.entered_at).toLocaleString()}
                    {h.exited_at
                      ? ` → ${new Date(h.exited_at).toLocaleString()}`
                      : " · still active"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by {h.super_admin_name ?? "Resonabed"}
                  </span>
                  {h.reason && (
                    <span className="w-full text-xs text-muted-foreground">
                      Reason: {h.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
