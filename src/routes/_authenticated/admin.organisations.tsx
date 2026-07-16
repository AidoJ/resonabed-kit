import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { listOrganisations, type OrgRow } from "@/lib/organisations.functions";
import {
  extendMusicLicence,
  expireMusicLicence,
} from "@/lib/licence.functions";
import { supabase } from "@/integrations/supabase/client";
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
  Star,
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
  const setTemplate = useMutation({
    mutationFn: (org_id: string) => callManageOrg({ type: "set_template", org_id }),
    onSuccess: () => {
      toast.success("Template organisation updated");
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
                    {o.is_template && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" /> Template
                      </Badge>
                    )}
                    <Badge variant={o.status === "active" ? "default" : "destructive"}>
                      {o.status}
                    </Badge>
                    {!o.is_configured && <Badge variant="outline">Setup pending</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {o.user_count} user{o.user_count === 1 ? "" : "s"} ·{" "}
                    {o.session_count_30d} session{o.session_count_30d === 1 ? "" : "s"} in last 30 days
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
                  {!o.is_template && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplate.mutate(o.id)}
                      disabled={setTemplate.isPending}
                    >
                      <Star className="mr-1 h-3.5 w-3.5" /> Set as template
                    </Button>
                  )}
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

      {tempPassword && (
        <TempPasswordDialog details={tempPassword} onClose={() => setTempPassword(null)} />
      )}
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
  const [seedServices, setSeedServices] = useState(true);
  const [seedFrequencies, setSeedFrequencies] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      callManageOrg({
        type: "create",
        name,
        brand_color: brandColor || null,
        admin_email: adminEmail,
        admin_display_name: adminName || null,
        seed_services: seedServices,
        seed_frequencies: seedFrequencies,
      }),
    onSuccess: (res) => {
      const password = res.temporary_password as string;
      onCreated({ email: adminEmail, password, orgName: name });
      onOpenChange(false);
      setName("");
      setBrandColor("");
      setAdminEmail("");
      setAdminName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create organisation</DialogTitle>
          <DialogDescription>
            Provisions a clinic and its first org admin. A temporary password is shown once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organisation name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-brand">Brand colour (optional)</Label>
            <Input
              id="org-brand"
              placeholder="#884bc7"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </div>
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
              <Label htmlFor="admin-name">Display name (optional)</Label>
              <Input
                id="admin-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
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
            disabled={create.isPending || !name.trim() || !adminEmail.trim()}
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
          <div className="space-y-2">
            <Label htmlFor="edit-brand">Brand colour</Label>
            <Input
              id="edit-brand"
              placeholder="#884bc7"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </div>
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

  const reset = useMutation({
    mutationFn: (user_id: string) =>
      callManageOrg({ type: "reset_admin_password", org_id: org.id, user_id }),
    onSuccess: (res, user_id) => {
      const target = admins.find((a) => a.user_id === user_id);
      onReset({
        email: (res.email as string) ?? target?.email ?? "",
        password: res.temporary_password as string,
        orgName: org.name,
      });
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
  const [displayName, setDisplayName] = useState("");

  const add = useMutation({
    mutationFn: () =>
      callManageOrg({
        type: "create_admin",
        org_id: org.id,
        admin_email: email,
        admin_display_name: displayName || null,
      }),
    onSuccess: (res) => {
      const password = res.temporary_password as string | null;
      const reused = !!res.reused_existing_user;
      if (reused) {
        toast.success(
          "Existing user promoted to org_admin. Use 'Reset admin password' if they need a new password.",
        );
        onAdded(null);
      } else if (password) {
        toast.success("Admin created");
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
            a temporary password is shown once.
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
            <Label htmlFor="add-admin-name">Display name (optional)</Label>
            <Input
              id="add-admin-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !email.trim()}>
            {add.isPending ? "Adding…" : "Add admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
