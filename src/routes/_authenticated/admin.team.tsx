import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listTeam } from "@/lib/admin.functions";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { sendAdminInviteEmail } from "@/lib/emails.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Copy, MailWarning } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({ meta: [{ title: "Team — Admin — ResonaBed" }] }),
  component: TeamAdmin,
});

async function callManageTeam(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-team-member", {
    body,
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as Record<string, unknown>;
}

function TeamAdmin() {
  const fetchTeam = useServerFn(listTeam);
  const fetchCtx = useServerFn(getCurrentUserContext);
  const sendInvite = useServerFn(sendAdminInviteEmail);
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => fetchCtx() });
  const { data: team, isLoading } = useQuery({
    queryKey: ["admin-team"],
    queryFn: () => fetchTeam(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    role: "practitioner" as "practitioner" | "org_admin",
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-team"] });

  const onCreate = async () => {
    if (!ctx?.org?.id) {
      toast.error("No organisation");
      return;
    }
    try {
      const res = await callManageTeam({
        type: "create",
        org_id: ctx.org.id,
        email: form.email,
        display_name: form.display_name || null,
        role: form.role,
      });
      setTempPassword(res.temporary_password as string);
      const tp = res.temporary_password as string;
      const emailTo = form.email;
      const dn = form.display_name || null;
      setForm({ email: "", display_name: "", role: "practitioner" });
      refresh();
      // Best-effort welcome email with the temporary password
      try {
        const r = await sendInvite({
          data: {
            email: emailTo,
            orgName: ctx.org?.name ?? "your clinic",
            orgId: ctx.org.id,
            recipientName: dn,
            tempPassword: tp,
            isReset: false,
          },
        });
        if (r?.sent) toast.success("Welcome email sent");
        else if (r?.reason === "recipient_suppressed")
          toast.warning("Email not sent — recipient is suppressed. Share the password manually.");
      } catch (e) {
        toast.warning(`Welcome email failed: ${(e as Error).message}. Share the password manually.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await callManageTeam({
        type: isActive ? "deactivate" : "reactivate",
        user_id: userId,
      });
      toast.success(isActive ? "Account deactivated" : "Account reactivated");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onChangeRole = async (userId: string, role: "practitioner" | "org_admin") => {
    try {
      await callManageTeam({ type: "change_role", user_id: userId, role });
      toast.success("Role updated");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<
    | { id: string; name: string }
    | null
  >(null);
  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await callManageTeam({ type: "delete", user_id: confirmDelete.id });
      toast.success("Team member removed");
      setConfirmDelete(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [resetting, setResetting] = useState<
    | { id: string; name: string }
    | null
  >(null);
  const [resetResult, setResetResult] = useState<{ email: string | null; password: string; name: string } | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const onReset = async () => {
    if (!resetting) return;
    setResetPending(true);
    try {
      const res = await callManageTeam({ type: "reset_password", user_id: resetting.id });
      const tp = res.temporary_password as string;
      const email = (res.email as string | null) ?? null;
      setResetResult({ email, password: tp, name: resetting.name });
      setResetting(null);
      if (email) {
        try {
          const r = await sendInvite({
            data: {
              email,
              orgName: ctx?.org?.name ?? "your clinic",
              orgId: ctx?.org?.id ?? null,
              recipientName: resetting.name,
              tempPassword: tp,
              isReset: true,
            },
          });
          if (r?.sent) toast.success("Password reset email sent");
          else if (r?.reason === "recipient_suppressed")
            toast.warning("Email not sent — recipient is suppressed. Share the password manually.");
        } catch (e) {
          toast.warning(`Email failed: ${(e as Error).message}. Share the password manually.`);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResetPending(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add team member
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-64" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
          ) : (
            (team ?? [])
              .filter((m) =>
                ctx?.roles.includes("super_admin") ? true : m.org_id === ctx?.org?.id,
              )
              .map((m) => {
                const isSelf = m.id === ctx?.userId;
                const isSuper = m.roles.includes("super_admin");
                const primaryRole = isSuper
                  ? "super_admin"
                  : m.roles.includes("org_admin")
                    ? "org_admin"
                    : m.roles.includes("practitioner")
                      ? "practitioner"
                      : "none";
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{m.display_name ?? "(no name)"}</span>
                        {m.email_status && m.email_status !== "valid" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="gap-1">
                                <MailWarning className="h-3 w-3" />
                                {m.email_status === "bounced" ? "Email undeliverable" : m.email_status === "complained" ? "Marked spam" : "Unsubscribed"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.email_status === "bounced"
                                ? "This user's email address bounced. Auth emails (password reset, invites) will not reach them."
                                : m.email_status === "complained"
                                  ? "Recipient marked our email as spam. Further sends are suppressed."
                                  : "Recipient unsubscribed."}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSuper ? (
                        <Badge variant="destructive">Super admin</Badge>
                      ) : (
                        <Select
                          value={primaryRole === "none" ? "practitioner" : primaryRole}
                          onValueChange={(v) =>
                            onChangeRole(m.id, v as "practitioner" | "org_admin")
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="practitioner">Practitioner</SelectItem>
                            <SelectItem value="org_admin">Org admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!isSuper && !isSelf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setResetting({ id: m.id, name: m.display_name ?? "this user" })
                            }
                          >
                            Reset password
                          </Button>
                        )}
                        {!isSuper && !isSelf && (
                          <Button
                            size="sm"
                            variant={m.is_active ? "outline" : "default"}
                            onClick={() => onToggleActive(m.id, m.is_active)}
                          >
                            {m.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                        {!isSuper && !isSelf && !m.roles.includes("org_admin") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setConfirmDelete({ id: m.id, name: m.display_name ?? "this user" })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
          )}
        </TableBody>
      </Table>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Account created. Copy this temporary password now — it will not be shown again.
                  The user must set a new password on first sign-in.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Input value={tempPassword} readOnly className="font-mono" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setTempPassword(null);
                    setCreateOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Display name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="practitioner">Practitioner</SelectItem>
                    <SelectItem value="org_admin">Org admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} disabled={!form.email}>Create</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirmDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the user account and revokes access. Sessions they created
            remain on the client's history for your records. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete}>Remove user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(v) => !v && setResetting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A new temporary password will be generated and emailed to the user. They will be
            signed out of all devices and must set a new password on next sign-in.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(null)} disabled={resetPending}>Cancel</Button>
            <Button onClick={onReset} disabled={resetPending}>
              {resetPending ? "Resetting…" : "Reset and email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetResult} onOpenChange={(v) => !v && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {resetResult?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                {resetResult?.email
                  ? "An email with the new password has been sent (if delivery succeeded). Copy it now as a backup — it will not be shown again."
                  : "Copy this temporary password now — it will not be shown again."}
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input value={resetResult?.password ?? ""} readOnly className="font-mono" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  if (resetResult) {
                    navigator.clipboard.writeText(resetResult.password);
                    toast.success("Copied");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
