import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { listOrganisations, type OrgRow } from "@/lib/organisations.functions";
import { sendAdminInviteEmail } from "@/lib/emails.functions";

import {
  extendMusicLicence,
  expireMusicLicence,
} from "@/lib/licence.functions";
import { enterSupportMode } from "@/lib/support-mode.functions";
import { checkOrgSupportGrantForSuper } from "@/lib/support-access.functions";
import {
  getAppSetting,
  setAppSetting,
  MUSIC_RENEWAL_PRICE_KEY,
} from "@/lib/app-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { BrandColorPicker } from "@/components/brand-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy,
  Ban,
  Play,
  Pencil,
  Plus,
  ShieldAlert,
  KeyRound,
  UserPlus,
  Users,
  UserMinus,
  Music,
  LifeBuoy,
  Tag,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/organisations")({
  head: () => ({ meta: [{ title: "Organisations — ResonaBed" }] }),
  component: OrganisationsPage,
});

async function callManageOrg(body: unknown): Promise<Record<string, unknown>> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-organisation", {
    body: body as Record<string, unknown>,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) {
    // supabase-js swallows the response body on non-2xx; try to surface it
    const ctx = (error as { context?: { body?: unknown } }).context;
    const raw = ctx?.body;
    let msg = error.message;
    if (raw instanceof ReadableStream) {
      try {
        const text = await new Response(raw).text();
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) msg = parsed.error;
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }
  return (data ?? {}) as Record<string, unknown>;
}

function OrganisationsPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });
  if (!ctxLoading && !ctx?.roles.includes("super_admin")) {
    throw redirect({ to: "/dashboard" });
  }

  const fetchOrgs = useServerFn(listOrganisations);
  const qc = useQueryClient();
  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organisations-super"],
    queryFn: () => fetchOrgs(),
    enabled: !!ctx?.roles.includes("super_admin"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [resetting, setResetting] = useState<OrgRow | null>(null);
  const [addingAdminTo, setAddingAdminTo] = useState<OrgRow | null>(null);
  const [managingLicence, setManagingLicence] = useState<OrgRow | null>(null);
  const [supportOrg, setSupportOrg] = useState<OrgRow | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [supportEmergency, setSupportEmergency] = useState(false);
  const navigate = useNavigate();
  const enterSupportFn = useServerFn(enterSupportMode);
  const enterSupport = useMutation({
    mutationFn: (v: { org_id: string; reason: string; emergency: boolean }) =>
      enterSupportFn({ data: v }),
    onSuccess: async () => {
      toast.success("Support mode active");
      setSupportOrg(null);
      setSupportReason("");
      setSupportEmergency(false);
      await qc.invalidateQueries({ queryKey: ["user-context"] });
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [tempPassword, setTempPassword] = useState<{
    email: string;
    password: string;
    orgName: string;
  } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["organisations-super"] });

  const suspend = useMutation({
    mutationFn: (org_id: string) => callManageOrg({ type: "suspend", org_id }),
    onSuccess: () => {
      toast.success("Organisation suspended");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivate = useMutation({
    mutationFn: (org_id: string) => callManageOrg({ type: "reactivate", org_id }),
    onSuccess: () => {
      toast.success("Organisation reactivated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });



  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Organisations</h2>
          <p className="text-sm text-muted-foreground">
            Every clinic that has bought a ResonaBed kit. Suspend to lock out unpaid subscribers.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New organisation
        </Button>
      </div>

      <GlobalSettingsCard />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/40 transition-colors">
          <Link to="/admin/promo-codes" className="block">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Promo codes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create percentage-off discount codes that apply to both the Pro and Premium kits at checkout.
            </CardContent>
          </Link>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-3">
          {(orgs ?? []).map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {o.name}
                    <Badge variant={o.status === "active" ? "default" : "destructive"}>
                      {o.status}
                    </Badge>
                    {!o.is_configured && <Badge variant="outline">Setup pending</Badge>}
                    <LicenceBadge org={o} />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {o.user_count} user{o.user_count === 1 ? "" : "s"} ·{" "}
                    {o.session_count_30d} session{o.session_count_30d === 1 ? "" : "s"} in last 30 days
                    {o.music_licence_expires_at ? (
                      <>
                        {" · "}Music licence{" "}
                        {o.music_licence_effective === "ok"
                          ? `expires ${new Date(o.music_licence_expires_at).toLocaleDateString()} (${o.music_licence_days_remaining} days)`
                          : `expired ${new Date(o.music_licence_expires_at).toLocaleDateString()}`}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingAdminTo(o)}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Add admin
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetting(o)}>
                    <Users className="mr-1 h-3.5 w-3.5" /> Manage admins
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setManagingLicence(o)}>
                    <Music className="mr-1 h-3.5 w-3.5" /> Music licence
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSupportOrg(o)}>
                    <LifeBuoy className="mr-1 h-3.5 w-3.5" /> Access for support
                  </Button>

                  {o.status === "active" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Suspend "${o.name}"? All users will be locked out immediately.`))
                          suspend.mutate(o.id);
                      }}
                      disabled={suspend.isPending}
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => reactivate.mutate(o.id)}
                      disabled={reactivate.isPending}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" /> Reactivate
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Created {new Date(o.created_at).toLocaleDateString()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(res) => {
          setTempPassword(res);
          invalidate();
        }}
      />

      {editing && (
        <EditOrgDialog
          org={editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      {resetting && (
        <ResetAdminPasswordDialog
          org={resetting}
          onOpenChange={(v) => !v && setResetting(null)}
          onReset={(res) => {
            setResetting(null);
            setTempPassword(res);
          }}
        />
      )}

      {addingAdminTo && (
        <AddAdminDialog
          org={addingAdminTo}
          onOpenChange={(v) => !v && setAddingAdminTo(null)}
          onAdded={(res) => {
            setAddingAdminTo(null);
            if (res) setTempPassword(res);
            invalidate();
          }}
        />
      )}

      {managingLicence && (
        <LicenceDialog
          org={managingLicence}
          onOpenChange={(v) => !v && setManagingLicence(null)}
          onSaved={() => {
            setManagingLicence(null);
            invalidate();
          }}
        />
      )}

      {tempPassword && (
        <TempPasswordDialog details={tempPassword} onClose={() => setTempPassword(null)} />
      )}

      <Dialog
        open={!!supportOrg}
        onOpenChange={(v) => {
          if (!v) {
            setSupportOrg(null);
            setSupportReason("");
            setSupportEmergency(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access {supportOrg?.name} for support</DialogTitle>
            <DialogDescription>
              Normal access requires the clinic to have granted a support-access window in
              their Settings. Every entry — normal or emergency — is logged in a permanent
              audit trail visible to the clinic.
            </DialogDescription>
          </DialogHeader>
          {supportOrg && <GrantStatus orgId={supportOrg.id} />}
          <div className="space-y-2">
            <Label htmlFor="support-reason">Reason for access</Label>
            <Input
              id="support-reason"
              placeholder="e.g. Investigating booking sync issue reported by admin"
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <Checkbox
              id="emergency"
              checked={supportEmergency}
              onCheckedChange={(v) => setSupportEmergency(Boolean(v))}
            />
            <Label htmlFor="emergency" className="text-sm font-normal">
              <strong className="text-destructive">Emergency access</strong> — bypass the
              grant requirement because the clinic cannot grant access right now (e.g. they're
              locked out). This will be flagged prominently in their audit trail.
            </Label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSupportOrg(null);
                setSupportReason("");
                setSupportEmergency(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={supportEmergency ? "destructive" : "default"}
              disabled={supportReason.trim().length < 3 || enterSupport.isPending}
              onClick={() =>
                supportOrg &&
                enterSupport.mutate({
                  org_id: supportOrg.id,
                  reason: supportReason.trim(),
                  emergency: supportEmergency,
                })
              }
            >
              {supportEmergency ? "Emergency enter" : "Enter support mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GrantStatus({ orgId }: { orgId: string }) {
  const fetchGrant = useServerFn(checkOrgSupportGrantForSuper);
  const { data } = useQuery({
    queryKey: ["support-grant-check", orgId],
    queryFn: () => fetchGrant({ data: { org_id: orgId } }),
  });
  if (!data) return null;
  return data.active ? (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">
      <Badge className="mr-2">Grant active</Badge>
      Until {data.expires_at ? new Date(data.expires_at).toLocaleString() : "—"}
    </div>
  ) : (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
      <Badge variant="secondary" className="mr-2">No active grant</Badge>
      Normal entry will be blocked. Use emergency access only if the clinic cannot grant it.
    </div>
  );
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (res: { email: string; password: string; orgName: string }) => void;
}) {
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [seedServices, setSeedServices] = useState(true);
  const [seedFrequencies, setSeedFrequencies] = useState(true);
  const [bundle, setBundle] = useState<"basic" | "pro">("basic");
  const sendInvite = useServerFn(sendAdminInviteEmail);
  const extendFn = useServerFn(extendMusicLicence);

  const create = useMutation({
    mutationFn: () =>
      callManageOrg({
        type: "create",
        name,
        brand_color: brandColor || null,
        admin_email: adminEmail,
        admin_display_name: adminName || null,
        admin_phone: adminPhone || null,
        seed_services: seedServices,
        seed_frequencies: seedFrequencies,
      }),
    onSuccess: async (res) => {
      const password = res.temporary_password as string;
      // Apply Pro bundle: stack +12 months on top of the auto-created 1-month trial.
      if (bundle === "pro" && res.org_id) {
        try {
          await extendFn({
            data: {
              org_id: res.org_id as string,
              months: 12,
              plan: "pro",
              note: "Pro bundle 13mo (trial + 12)",
            },
          });
        } catch (e) {
          toast.error(
            "Org created but Pro bundle extension failed. Apply manually via Extend licence. " +
              ((e as Error).message ?? ""),
          );
        }
      }
      // Fire-and-forget email; do not block dialog on delivery failure.
      try {
        await sendInvite({
          data: {
            email: adminEmail,
            orgName: name,
            recipientName: adminName || null,
            tempPassword: password,
            isReset: false,
          },
        });
        toast.success("Invite email sent to " + adminEmail);
      } catch (e) {
        toast.error(
          "Org created but the invite email failed to send. Share the temporary password manually. " +
            ((e as Error).message ?? ""),
        );
      }
      onCreated({ email: adminEmail, password, orgName: name });
      onOpenChange(false);
      setName("");
      setBrandColor("");
      setAdminEmail("");
      setAdminName("");
      setAdminPhone("");
      setBundle("basic");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create organisation</DialogTitle>
          <DialogDescription>
            Provisions a clinic and its first org admin. A temporary password is emailed to the
            admin and shown here once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organisation name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <BrandColorPicker
            id="org-brand"
            label="Brand colour (optional)"
            value={brandColor}
            onChange={setBrandColor}
          />

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">First org admin</p>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-name">Contact name</Label>
              <Input
                id="admin-name"
                placeholder="Full name of the primary contact"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-phone">Phone number (optional)</Label>
              <Input
                id="admin-phone"
                type="tel"
                placeholder="+61 …"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Music licence bundle</p>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                id="bundle-basic"
                name="bundle"
                className="mt-1"
                checked={bundle === "basic"}
                onChange={() => setBundle("basic")}
              />
              <Label htmlFor="bundle-basic" className="font-normal">
                Basic — 1 month trial only
                <span className="block text-xs text-muted-foreground">
                  Default. Org starts with the standard 1-month trial.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                id="bundle-pro"
                name="bundle"
                className="mt-1"
                checked={bundle === "pro"}
                onChange={() => setBundle("pro")}
              />
              <Label htmlFor="bundle-pro" className="font-normal">
                Pro / Platinum — trial + 12 months
                <span className="block text-xs text-muted-foreground">
                  Stacks 12 months on top of the trial (~13 months total from creation).
                </span>
              </Label>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-2">

            <p className="text-sm font-medium">Seed from template organisation</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="seed-services"
                checked={seedServices}
                onCheckedChange={(v) => setSeedServices(!!v)}
              />
              <Label htmlFor="seed-services" className="font-normal">
                Copy default services
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="seed-freq"
                checked={seedFrequencies}
                onCheckedChange={(v) => setSeedFrequencies(!!v)}
              />
              <Label htmlFor="seed-freq" className="font-normal">
                Frequencies (global — always available)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Audio library is global — new organisations inherit the shipped Solfeggio tracks
              automatically. Frequencies are global too.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={
              create.isPending || !name.trim() || !adminEmail.trim() || !adminName.trim()
            }
          >
            {create.isPending ? "Creating…" : "Create organisation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EditOrgDialog({
  org,
  onOpenChange,
  onSaved,
}: {
  org: OrgRow;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [brandColor, setBrandColor] = useState(org.brand_color ?? "");
  const save = useMutation({
    mutationFn: () =>
      callManageOrg({
        type: "update",
        org_id: org.id,
        name,
        brand_color: brandColor || null,
      }),
    onSuccess: () => {
      toast.success("Organisation updated");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit organisation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <BrandColorPicker
            id="edit-brand"
            value={brandColor}
            onChange={setBrandColor}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TempPasswordDialog({
  details,
  onClose,
}: {
  details: { email: string; password: string; orgName: string };
  onClose: () => void;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(details.password);
    toast.success("Password copied");
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Temporary password
          </DialogTitle>
          <DialogDescription>
            Save this now. It won't be shown again. The admin will be forced to change it on first
            login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <div>
            <span className="text-muted-foreground">Organisation:</span> {details.orgName}
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span> {details.email}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Password:</span>
            <code className="rounded bg-background px-2 py-1 font-mono text-xs">
              {details.password}
            </code>
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetAdminPasswordDialog({
  org,
  onOpenChange,
  onReset,
}: {
  org: OrgRow;
  onOpenChange: (v: boolean) => void;
  onReset: (res: { email: string; password: string; orgName: string }) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["org-admins", org.id],
    queryFn: () => callManageOrg({ type: "list_admins", org_id: org.id }),
  });
  const admins =
    (data?.admins as Array<{ user_id: string; email: string | null; display_name: string | null }> | undefined) ?? [];

  const sendInvite = useServerFn(sendAdminInviteEmail);
  const reset = useMutation({
    mutationFn: (user_id: string) =>
      callManageOrg({ type: "reset_admin_password", org_id: org.id, user_id }),
    onSuccess: async (res, user_id) => {
      const target = admins.find((a) => a.user_id === user_id);
      const email = (res.email as string) ?? target?.email ?? "";
      const password = res.temporary_password as string;
      if (email && password) {
        try {
          await sendInvite({
            data: {
              email,
              orgName: org.name,
              recipientName: target?.display_name ?? null,
              tempPassword: password,
              isReset: true,
            },
          });
          toast.success("Reset email sent to " + email);
        } catch (e) {
          toast.error(
            "Password reset, but email failed. Share manually. " + ((e as Error).message ?? ""),
          );
        }
      }
      onReset({ email, password, orgName: org.name });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const revoke = useMutation({
    mutationFn: (user_id: string) =>
      callManageOrg({ type: "revoke_admin", org_id: org.id, user_id }),
    onSuccess: () => {
      toast.success("Admin access revoked. The user was signed out on all devices.");
      qc.invalidateQueries({ queryKey: ["org-admins", org.id] });
      qc.invalidateQueries({ queryKey: ["organisations-super"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Manage admins
          </DialogTitle>
          <DialogDescription>
            Admins for <strong>{org.name}</strong>. Reset a password to issue a new temporary one and
            sign the admin out everywhere. Revoke to remove their org_admin role — their account
            stays, but they lose all access to this organisation. Add a replacement with "Add admin"
            before revoking the last one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading admins…</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This organisation has no org admin accounts. Use "Add admin" to seat one.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {admins.map((a) => {
                const busy =
                  (reset.isPending && reset.variables === a.user_id) ||
                  (revoke.isPending && revoke.variables === a.user_id);
                return (
                  <div
                    key={a.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">{a.display_name ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.email ?? a.user_id}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => reset.mutate(a.user_id)}
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy || admins.length <= 1}
                        title={
                          admins.length <= 1
                            ? "Add another admin before revoking the last one"
                            : undefined
                        }
                        onClick={() => {
                          const label = a.display_name ?? a.email ?? a.user_id;
                          if (
                            confirm(
                              `Revoke org_admin from ${label}? They'll be signed out and lose all access to ${org.name}.`,
                            )
                          )
                            revoke.mutate(a.user_id);
                        }}
                      >
                        <UserMinus className="mr-1 h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAdminDialog({
  org,
  onOpenChange,
  onAdded,
}: {
  org: OrgRow;
  onOpenChange: (v: boolean) => void;
  onAdded: (res: { email: string; password: string; orgName: string } | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const sendInvite = useServerFn(sendAdminInviteEmail);

  const add = useMutation({
    mutationFn: () =>
      callManageOrg({
        type: "create_admin",
        org_id: org.id,
        admin_email: email,
        admin_display_name: contactName || null,
        admin_phone: phone || null,
      }),
    onSuccess: async (res) => {
      const password = res.temporary_password as string | null;
      const reused = !!res.reused_existing_user;
      if (reused) {
        toast.success(
          "Existing user promoted to org_admin. Use 'Reset admin password' if they need a new password.",
        );
        onAdded(null);
      } else if (password) {
        try {
          await sendInvite({
            data: {
              email,
              orgName: org.name,
              recipientName: contactName || null,
              tempPassword: password,
              isReset: false,
            },
          });
          toast.success("Invite email sent to " + email);
        } catch (e) {
          toast.error(
            "Admin created but the invite email failed. Share the temporary password manually. " +
              ((e as Error).message ?? ""),
          );
        }
        onAdded({ email, password, orgName: org.name });
      } else {
        onAdded(null);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Add org admin
          </DialogTitle>
          <DialogDescription>
            Seat a new org admin for <strong>{org.name}</strong>. If the email already belongs to a
            user in this org, they're promoted to org_admin; otherwise a new account is created and
            a temporary password is emailed and shown once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-admin-email">Email</Label>
            <Input
              id="add-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-admin-name">Contact name</Label>
            <Input
              id="add-admin-name"
              placeholder="Full name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-admin-phone">Phone number (optional)</Label>
            <Input
              id="add-admin-phone"
              type="tel"
              placeholder="+61 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || !email.trim() || !contactName.trim()}
          >
            {add.isPending ? "Adding…" : "Add admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function LicenceBadge({ org }: { org: OrgRow }) {
  if (org.music_licence_effective === "expired") {
    return <Badge variant="destructive">Licence expired</Badge>;
  }
  const days = org.music_licence_days_remaining ?? 0;
  if (org.music_licence_status === "trial") {
    return <Badge variant="secondary">Trial · {days}d left</Badge>;
  }
  const variant = days <= 30 ? "outline" : "default";
  return <Badge variant={variant}>Licence · {days}d</Badge>;
}

function LicenceDialog({
  org,
  onOpenChange,
  onSaved,
}: {
  org: OrgRow;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const extendFn = useServerFn(extendMusicLicence);
  const expireFn = useServerFn(expireMusicLicence);
  const [preset, setPreset] = useState<"1" | "12" | "custom">("12");
  const [customMonths, setCustomMonths] = useState<number>(6);
  const [plan, setPlan] = useState<"basic" | "pro" | "none">("pro");
  const [note, setNote] = useState<string>("");

  const months = preset === "1" ? 1 : preset === "12" ? 12 : Math.max(1, customMonths);

  const extend = useMutation({
    mutationFn: () =>
      extendFn({
        data: { org_id: org.id, months, plan, note: note.trim() || undefined },
      }),
    onSuccess: (res) => {
      toast.success(
        `+${res.months_added} months. New expiry: ${new Date(res.expires_at).toLocaleDateString()}`,
      );
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const expire = useMutation({
    mutationFn: () =>
      expireFn({ data: { org_id: org.id, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Licence marked expired");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentExpiry = org.music_licence_expires_at
    ? new Date(org.music_licence_expires_at)
    : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" /> Music licence — {org.name}
          </DialogTitle>
          <DialogDescription>
            Extensions stack onto the existing expiry, so no unused days are lost. The
            org's own uploaded audio is unaffected — only the 9 global tracks are gated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <strong>{org.music_licence_status}</strong>
              {" · "}
              <span className="text-muted-foreground">Effective:</span>{" "}
              <strong>{org.music_licence_effective}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Expires:</span>{" "}
              {currentExpiry ? currentExpiry.toLocaleString() : "—"}
              {org.music_licence_days_remaining !== null
                ? ` (${org.music_licence_days_remaining} days remaining)`
                : ""}
            </div>
            <div>
              <span className="text-muted-foreground">Plan:</span>{" "}
              {org.music_licence_plan}
            </div>
            {org.music_licence_note ? (
              <div>
                <span className="text-muted-foreground">Last note:</span>{" "}
                {org.music_licence_note}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Extend by</Label>
            <RadioGroup
              value={preset}
              onValueChange={(v) => setPreset(v as "1" | "12" | "custom")}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                <RadioGroupItem value="12" id="lic-12" />
                <span className="text-sm">+12 months (annual)</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                <RadioGroupItem value="1" id="lic-1" />
                <span className="text-sm">+1 month</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                <RadioGroupItem value="custom" id="lic-c" />
                <span className="text-sm">Custom</span>
              </label>
            </RadioGroup>
            {preset === "custom" && (
              <Input
                type="number"
                min={1}
                max={120}
                value={customMonths}
                onChange={(e) => setCustomMonths(parseInt(e.target.value) || 1)}
                className="max-w-[140px]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Plan label</Label>
            <RadioGroup
              value={plan}
              onValueChange={(v) => setPlan(v as "basic" | "pro" | "none")}
              className="flex gap-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="pro" /> Pro / Platinum
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="basic" /> Basic
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="none" /> None
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lic-note">Note (optional)</Label>
            <Input
              id="lic-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Pro bundle 13mo — $49.50 paid"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              if (
                confirm(
                  `Expire licence for "${org.name}" immediately? Their access to the 9 global tracks will stop.`,
                )
              )
                expire.mutate();
            }}
            disabled={expire.isPending || extend.isPending}
          >
            Expire now
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => extend.mutate()} disabled={extend.isPending}>
              {extend.isPending ? "Extending…" : `Extend +${months} months`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function GlobalSettingsCard() {
  const fetchSetting = useServerFn(getAppSetting);
  const saveSetting = useServerFn(setAppSetting);
  const qc = useQueryClient();
  const { data: current, isLoading } = useQuery({
    queryKey: ["app-setting", MUSIC_RENEWAL_PRICE_KEY],
    queryFn: () => fetchSetting({ data: { key: MUSIC_RENEWAL_PRICE_KEY } }),
  });
  const [value, setValue] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const shown = dirty ? value : (current ?? "");

  const save = useMutation({
    mutationFn: (v: string | null) =>
      saveSetting({ data: { key: MUSIC_RENEWAL_PRICE_KEY, value: v } }),
    onSuccess: () => {
      toast.success("Renewal price updated");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["app-setting", MUSIC_RENEWAL_PRICE_KEY] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Global settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="renewal-price">Music licence renewal price (display only)</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="renewal-price"
              placeholder="e.g. $49.50/year"
              value={shown}
              disabled={isLoading}
              onChange={(e) => {
                setValue(e.target.value);
                setDirty(true);
              }}
              className="max-w-sm"
            />
            <Button
              onClick={() => save.mutate(value.trim() ? value.trim() : null)}
              disabled={!dirty || save.isPending}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            {current ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setValue("");
                  setDirty(true);
                }}
                disabled={save.isPending}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Shown in each org's licence-expiry banner. Leave blank to hide the price.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

