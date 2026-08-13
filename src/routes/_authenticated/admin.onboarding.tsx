import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Copy, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createOnboardingOrderManually,
  listOnboardingOrders,
  markOnboardingOrderProvisioned,
  updateOnboardingOrder,
  type OnboardingOrderRow,
} from "@/lib/onboarding.functions";
import { sendAdminInviteEmail } from "@/lib/emails.functions";
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

export const Route = createFileRoute("/_authenticated/admin/onboarding")({
  head: () => ({ meta: [{ title: "Clinic onboarding, ResonaBed" }] }),
  component: OnboardingPage,
});

async function callManageOrg(body: unknown): Promise<Record<string, unknown>> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-organisation", {
    body: body as Record<string, unknown>,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) {
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

const money = (cents: number | null) =>
  cents === null ? "—" : `$${(cents / 100).toFixed(2)} AUD`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function OnboardingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOnboardingOrders);
  const updateFn = useServerFn(updateOnboardingOrder);
  const [active, setActive] = useState<OnboardingOrderRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["kit-onboarding-orders"],
    queryFn: () => listFn(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["kit-onboarding-orders"] });

  const cancel = useMutation({
    mutationFn: (id: string) => updateFn({ data: { id, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Order marked cancelled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinic onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paid business orders waiting to become clinics. Slug, ABN and clinic type are set by
            hand here, never guessed, because clinic type controls whether a practitioner's street
            address can ever appear publicly.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          Add order by hand
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No business orders yet. Paid clinic purchases land here automatically.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Awaiting provisioning ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting. Nice.</p>
            ) : (
              pending.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onProvision={() => setActive(o)}
                  onCancel={() => cancel.mutate(o.id)}
                />
              ))
            )}
          </section>

          {done.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Completed ({done.length})
              </h2>
              {done.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </section>
          ) : null}
        </div>
      )}

      <ProvisionDialog
        order={active}
        onOpenChange={(open) => !open && setActive(null)}
        onDone={() => {
          setActive(null);
          refresh();
        }}
      />
    </div>
  );
}

function OrderCard({
  order,
  onProvision,
  onCancel,
}: {
  order: OnboardingOrderRow;
  onProvision?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.business_name ?? "Unnamed clinic"}</span>
            <Badge variant={order.status === "pending" ? "default" : "secondary"}>
              {order.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.contact_name ? `${order.contact_name}, ` : ""}
            {order.contact_email}
            {order.contact_phone ? ` · ${order.contact_phone}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.package_key ?? "kit"} · {order.plan ?? "full"} · {money(order.amount_cents)} ·{" "}
            {order.source}
            {order.abn ? ` · ABN ${order.abn}` : ""} ·{" "}
            {new Date(order.created_at).toLocaleString()}
          </p>
          {order.shipping_address ? (
            <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
              {order.shipping_address}
            </p>
          ) : null}
        </div>
        {order.status === "pending" ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={onProvision}>
              Provision clinic
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProvisionDialog({
  order,
  onOpenChange,
  onDone,
}: {
  order: OnboardingOrderRow | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const markFn = useServerFn(markOnboardingOrderProvisioned);
  const sendInvite = useServerFn(sendAdminInviteEmail);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [abn, setAbn] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [clinicType, setClinicType] = useState<"home" | "retail" | null>(null);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!order) return;
    setName(order.business_name ?? "");
    setSlug(slugify(order.business_name ?? ""));
    setAbn(order.abn ?? "");
    setAdminEmail(order.contact_email);
    setAdminName(order.contact_name ?? "");
    setAdminPhone(order.contact_phone ?? "");
    setClinicType(null);
    setResult(null);
  }, [order]);

  const provision = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order selected");
      if (!clinicType) throw new Error("Choose the clinic type before provisioning");
      const res = await callManageOrg({
        type: "create",
        name: name.trim(),
        slug: slug.trim() || null,
        abn: abn.trim() || null,
        business_name: name.trim(),
        contact_email: adminEmail.trim(),
        clinic_type: clinicType,
        admin_email: adminEmail.trim(),
        admin_display_name: adminName.trim() || null,
        admin_phone: adminPhone.trim() || null,
        seed_services: true,
        seed_frequencies: true,
      });
      const orgId = res["org_id"] as string | undefined;
      const password = res["temporary_password"] as string;
      if (orgId) await markFn({ data: { id: order.id, orgId } });
      try {
        await sendInvite({
          data: {
            email: adminEmail.trim(),
            orgName: name.trim(),
            recipientName: adminName.trim() || null,
            tempPassword: password,
            isReset: false,
          },
        });
      } catch (e) {
        toast.error(
          "Clinic created but the login email failed. Share the temporary password manually. " +
            ((e as Error).message ?? ""),
        );
      }
      return { email: adminEmail.trim(), password };
    },
    onSuccess: (r) => {
      toast.success("Clinic provisioned and login emailed");
      setResult(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Provision clinic</DialogTitle>
          <DialogDescription>
            Creates the organisation, seeds services and policies, creates the first admin and
            emails their temporary password.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Temporary password</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded bg-background px-2 py-1 text-sm">{result.password}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.password);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Emailed to {result.email}. They must change it at first sign-in.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onDone}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Clinic name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Public web address</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="spirallight"
                />
                <p className="text-xs text-muted-foreground">resonabed.com/o/{slug || "…"}</p>
              </div>
              <div className="space-y-1.5">
                <Label>ABN (optional)</Label>
                <Input value={abn} onChange={(e) => setAbn(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <ShieldCheck className="h-4 w-4" /> Clinic type, set this correctly
              </div>
              <p className="text-xs text-amber-900/80">
                Home-based clinics never show a street address publicly. Retail premises do. This is
                never inferred from the order, confirm it with the buyer.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={clinicType === "home" ? "default" : "outline"}
                  onClick={() => setClinicType("home")}
                >
                  Home-based
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={clinicType === "retail" ? "default" : "outline"}
                  onClick={() => setClinicType("retail")}
                >
                  Retail premises
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Admin email</Label>
                <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Admin name</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin phone (optional)</Label>
              <Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => provision.mutate()}
                disabled={provision.isPending || !name.trim() || !adminEmail.trim() || !clinicType}
              >
                {provision.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Provision clinic
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
