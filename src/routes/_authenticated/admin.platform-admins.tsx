import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPlatformAdmins,
  createPlatformAdmin,
  revokePlatformAdmin,
} from "@/lib/profile.functions";
import { sendAdminInviteEmail } from "@/lib/emails.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldPlus, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/platform-admins")({
  head: () => ({
    meta: [
      { title: "Platform admins, ResonaBed" },
      {
        name: "description",
        content: "Manage ResonaBed platform administrators with cross-clinic access.",
      },
      { property: "og:title", content: "Platform admins, ResonaBed" },
      {
        property: "og:description",
        content: "Manage ResonaBed platform administrators with cross-clinic access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformAdminsPage,
});

function PlatformAdminsPage() {
  const fetchAdmins = useServerFn(listPlatformAdmins);
  const createAdmin = useServerFn(createPlatformAdmin);
  const revoke = useServerFn(revokePlatformAdmin);
  const sendInvite = useServerFn(sendAdminInviteEmail);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: () => fetchAdmins(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", display_name: "" });
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const submit = async () => {
    if (!form.email.trim() || !form.display_name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      const res = await createAdmin({ data: form });
      setTempPassword(res.tempPassword);
      try {
        await sendInvite({
          data: {
            email: res.email,
            recipientName: form.display_name,
            orgName: "Resonabed platform",
            tempPassword: res.tempPassword,
          },
        });
        toast.success("Platform admin added, invite emailed");
      } catch {
        toast.warning("Platform admin added, but the invite email failed to send");
      }
      setForm({ email: "", display_name: "" });
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (userId: string, name: string | null) => {
    if (!confirm(`Remove platform admin access for ${name ?? "this user"}?`)) return;
    try {
      await revoke({ data: { user_id: userId } });
      toast.success("Platform admin access removed");
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Platform admins</h1>
          <p className="text-sm text-muted-foreground">
            Platform admins can manage every organisation. Clinic health records stay locked behind
            support-mode grants.
          </p>
        </div>
        <Button
          onClick={() => {
            setTempPassword(null);
            setOpen(true);
          }}
        >
          <ShieldPlus className="mr-2 h-4 w-4" /> Add platform admin
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((a) => (
              <TableRow key={a.userId}>
                <TableCell className="font-medium">
                  {a.displayName ?? "Unnamed"}{" "}
                  {a.isSelf && (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={a.isActive ? "secondary" : "destructive"}>
                    {a.isActive ? "Active" : "Suspended"}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={a.isSelf}
                    onClick={() => onRevoke(a.userId, a.displayName)}
                  >
                    Remove access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add platform admin</DialogTitle>
            <DialogDescription>
              Grants full Resonabed platform access. Existing users keep their account and are given
              a new temporary password.
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Temporary password, shown once. They must change it at first sign-in.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Input readOnly value={tempPassword} className="font-mono" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pa-name">Full name</Label>
                <Input
                  id="pa-name"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-email">Email</Label>
                <Input
                  id="pa-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {tempPassword ? (
              <Button
                onClick={() => {
                  setTempPassword(null);
                  setOpen(false);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={busy}>
                  {busy ? "Adding…" : "Add platform admin"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
