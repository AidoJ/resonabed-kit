import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listAccessCodes,
  issueAccessCodeManually,
  regenerateAccessCode,
  resendAccessCode,
  revokeAccessCode,
  type AccessCodeRow,
} from "@/lib/home-codes.functions";
import {
  listHomeUsers,
  updateHomeUserEmail,
  type HomeUserRow,
} from "@/lib/home-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/access-codes")({
  head: () => ({ meta: [{ title: "Home access codes, ResonaBed" }] }),
  component: AccessCodesPage,
});

function statusVariant(status: string) {
  if (status === "redeemed") return "secondary" as const;
  if (status === "revoked") return "outline" as const;
  return "default" as const;
}

function AccessCodesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAccessCodes);
  const issueFn = useServerFn(issueAccessCodeManually);
  const revokeFn = useServerFn(revokeAccessCode);
  const regenFn = useServerFn(regenerateAccessCode);
  const resendFn = useServerFn(resendAccessCode);

  const [issueOpen, setIssueOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", phone: "", reference: "" });
  const [filter, setFilter] = useState("");

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["kit-access-codes"],
    queryFn: () => listFn(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["kit-access-codes"] });

  const issue = useMutation({
    mutationFn: () =>
      issueFn({
        data: {
          buyerEmail: form.email.trim(),
          buyerName: form.name.trim() || undefined,
          buyerPhone: form.phone.trim() || undefined,
          reference: form.reference.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.alreadyExisted ? `Existing code ${r.code} reused` : `Code ${r.code} issued and emailed`,
      );
      setIssueOpen(false);
      setForm({ email: "", name: "", phone: "", reference: "" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not issue a code"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id, reason: "Revoked by platform admin" } }),
    onSuccess: () => {
      toast.success("Code revoked");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke that code"),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenFn({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`New code ${r.code} issued and emailed`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not regenerate that code"),
  });

  const resend = useMutation({
    mutationFn: (id: string) => resendFn({ data: { id } }),
    onSuccess: (r) =>
      r.sent ? toast.success(`Code resent to ${r.email}`) : toast.error("The email did not send"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not resend that code"),
  });

  const q = filter.trim().toLowerCase();
  const rows = q
    ? codes.filter(
        (c: AccessCodeRow) =>
          c.code.toLowerCase().includes(q) ||
          c.buyer_email.toLowerCase().includes(q) ||
          (c.buyer_name ?? "").toLowerCase().includes(q),
      )
    : codes;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Home access codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time codes that let a kit buyer set up the personal Resonabed app. Codes are issued
            automatically when a purchase completes.
          </p>
        </div>
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Issue a code
        </Button>
      </div>

      <Input
        placeholder="Search by code, email or name"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <KeyRound className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  No access codes yet.
                </td>
              </tr>
            ) : (
              rows.map((c: AccessCodeRow) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-mono tracking-wide hover:text-primary"
                      onClick={() => {
                        void navigator.clipboard.writeText(c.code);
                        toast.success("Code copied");
                      }}
                    >
                      {c.code}
                      <Copy className="h-3.5 w-3.5 opacity-50" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div>{c.buyer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.buyer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div className="capitalize">{c.source}</div>
                    {c.source_ref ? (
                      <div className="max-w-[180px] truncate">{c.source_ref}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(c.status)} className="capitalize">
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.issued_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={c.status !== "issued"}
                          onClick={() => resend.mutate(c.id)}
                        >
                          Resend email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={c.status === "redeemed"}
                          onClick={() => regenerate.mutate(c.id)}
                        >
                          Regenerate code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={c.status !== "issued"}
                          className="text-destructive"
                          onClick={() => revoke.mutate(c.id)}
                        >
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue an access code</DialogTitle>
            <DialogDescription>
              For phone or bank-transfer orders. The code is emailed to the buyer straight away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ac-email">Buyer email</Label>
              <Input
                id="ac-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ac-name">Buyer name</Label>
              <Input
                id="ac-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ac-phone">Phone (optional)</Label>
              <Input
                id="ac-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ac-ref">Order reference (optional)</Label>
              <Input
                id="ac-ref"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="INV-00042"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.email.includes("@") || issue.isPending}
              onClick={() => issue.mutate()}
            >
              {issue.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Issue and email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
