import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listKitInvoices,
  createKitInvoice,
  setKitInvoiceStatus,
  deleteKitInvoice,
  recordKitPayment,
  type KitInvoice,
} from "@/lib/invoices.functions";
import { getBillingProfile, saveBillingProfile, EMPTY_BILLING_PROFILE } from "@/lib/billing-profile.functions";
import { KitDocumentDialog } from "@/components/kit-document-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({
    meta: [
      { title: "Kit invoices, Admin, ResonaBed" },
      { name: "description", content: "Raise EFT tax invoices for ResonaBed kit orders and track their status." },
    ],
  }),
  component: InvoicesAdmin,
});

const money = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

const PACKAGES = [
  { key: "pro", label: "Resonabed Pro Kit", cents: 119900 },
  { key: "premium", label: "Resonabed Premium Kit", cents: 139900 },
];

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  void: "destructive",
};

function InvoicesAdmin() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listKitInvoices);
  const fetchProfile = useServerFn(getBillingProfile);
  const saveProfile = useServerFn(saveBillingProfile);
  const create = useServerFn(createKitInvoice);
  const setStatus = useServerFn(setKitInvoiceStatus);
  const removeInvoice = useServerFn(deleteKitInvoice);
  const pay = useServerFn(recordKitPayment);

  const { data, isLoading, error } = useQuery({ queryKey: ["kit-invoices"], queryFn: () => fetchAll() });
  const { data: profile } = useQuery({ queryKey: ["billing-profile"], queryFn: () => fetchProfile() });

  const [openNew, setOpenNew] = useState(false);
  const [viewing, setViewing] = useState<KitInvoice | null>(null);
  const [payingFor, setPayingFor] = useState<KitInvoice | null>(null);
  const [profileForm, setProfileForm] = useState<typeof EMPTY_BILLING_PROFILE | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["kit-invoices"] });
    qc.invalidateQueries({ queryKey: ["kit-payments"] });
  };

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof create>[0]) => create(input),
    onSuccess: () => { toast.success("Invoice created"); setOpenNew(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const payMut = useMutation({
    mutationFn: (input: Parameters<typeof pay>[0]) => pay(input),
    onSuccess: () => { toast.success("Payment recorded, receipt issued"); setPayingFor(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (input: Parameters<typeof setStatus>[0]) => setStatus(input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (input: Parameters<typeof removeInvoice>[0]) => removeInvoice(input),
    onSuccess: () => { toast.success("Invoice deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const profileMut = useMutation({
    mutationFn: (input: Parameters<typeof saveProfile>[0]) => saveProfile(input),
    onSuccess: () => { toast.success("Billing details saved"); qc.invalidateQueries({ queryKey: ["billing-profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading invoices…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load invoices: {(error as Error).message}</p>;

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const paidFor = (id: string) =>
    payments.filter((p) => p.invoice_id === id).reduce((a, p) => a + p.amount_cents, 0);

  const p = profileForm ?? profile ?? EMPTY_BILLING_PROFILE;
  const setP = (patch: Partial<typeof EMPTY_BILLING_PROFILE>) => setProfileForm({ ...p, ...patch });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Raise a tax invoice for a kit paid by EFT (bank transfer) or card. Recording a payment
            issues a numbered receipt automatically.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" /> New invoice
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Your billing details (shown on invoices and receipts)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Business name</Label><Input value={p.businessName} onChange={(e) => setP({ businessName: e.target.value })} /></div>
          <div><Label>ABN</Label><Input value={p.abn} onChange={(e) => setP({ abn: e.target.value })} /></div>
          <div><Label>Address</Label><Input value={p.address} onChange={(e) => setP({ address: e.target.value })} /></div>
          <div><Label>Billing email</Label><Input value={p.email} onChange={(e) => setP({ email: e.target.value })} /></div>
          <div><Label>Account name</Label><Input value={p.accountName} onChange={(e) => setP({ accountName: e.target.value })} /></div>
          <div><Label>Bank</Label><Input value={p.bankName} onChange={(e) => setP({ bankName: e.target.value })} /></div>
          <div><Label>BSB</Label><Input value={p.bsb} onChange={(e) => setP({ bsb: e.target.value })} /></div>
          <div><Label>Account number</Label><Input value={p.accountNumber} onChange={(e) => setP({ accountNumber: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button size="sm" onClick={() => profileMut.mutate({ data: p } as any)} disabled={profileMut.isPending}>
              {profileMut.isPending ? "Saving…" : "Save billing details"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="whitespace-nowrap font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div className="min-w-40">
                      <div>{inv.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{inv.customer_email ?? ""}</div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{inv.package_label}</TableCell>
                  <TableCell className="uppercase text-xs">{inv.payment_terms}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money(inv.total_cents, inv.currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money(inv.gst_cents, inv.currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money(paidFor(inv.id), inv.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"} className="capitalize">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setViewing(inv)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPayingFor(inv)} disabled={inv.status === "void"}>
                        <Banknote className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMut.mutate({ data: { id: inv.id, status: inv.status === "void" ? "draft" : "void" } })}
                      >
                        {inv.status === "void" ? "Restore" : "Void"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { if (confirm(`Delete ${inv.invoice_number}?`)) deleteMut.mutate({ data: { id: inv.id } }); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewInvoiceDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        pending={createMut.isPending}
        onSubmit={(payload) => createMut.mutate({ data: payload } as any)}
      />

      <RecordPaymentDialog
        invoice={payingFor}
        outstanding={payingFor ? Math.max(0, payingFor.total_cents - paidFor(payingFor.id)) : 0}
        pending={payMut.isPending}
        onClose={() => setPayingFor(null)}
        onSubmit={(payload) => payMut.mutate({ data: payload } as any)}
      />

      <KitDocumentDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        invoice={viewing}
        profile={profile ?? EMPTY_BILLING_PROFILE}
      />
    </div>
  );
}

function NewInvoiceDialog({
  open, onClose, onSubmit, pending,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [pkg, setPkg] = useState(PACKAGES[0]);
  const [form, setForm] = useState({
    customerName: "", customerEmail: "", customerPhone: "",
    billingAddress: "", shippingAddress: "",
    discount: "0", shipping: "0", shippingRegion: "",
    gstFreeShipping: false, paymentTerms: "eft", dueDate: "", notes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const dollars = (v: string) => Math.round((Number(v) || 0) * 100);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New kit invoice</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Customer name *</Label>
            <Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} />
          </div>
          <div><Label>Email</Label><Input value={form.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Billing address</Label><Input value={form.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Shipping address</Label><Input value={form.shippingAddress} onChange={(e) => set({ shippingAddress: e.target.value })} /></div>
          <div>
            <Label>Package</Label>
            <Select value={pkg.key} onValueChange={(v) => setPkg(PACKAGES.find((x) => x.key === v)!)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PACKAGES.map((x) => (
                  <SelectItem key={x.key} value={x.key}>{x.label}, {money(x.cents)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment terms</Label>
            <Select value={form.paymentTerms} onValueChange={(v) => set({ paymentTerms: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eft">EFT / bank transfer (paid in full)</SelectItem>
                <SelectItem value="card">Card via website checkout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Discount ($)</Label><Input value={form.discount} onChange={(e) => set({ discount: e.target.value })} /></div>
          <div><Label>Shipping ($)</Label><Input value={form.shipping} onChange={(e) => set({ shipping: e.target.value })} /></div>
          <div><Label>Shipping region</Label><Input placeholder="e.g. metro, nz" value={form.shippingRegion} onChange={(e) => set({ shippingRegion: e.target.value })} /></div>
          <div><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="gstfree" type="checkbox" checked={form.gstFreeShipping} onChange={(e) => set({ gstFreeShipping: e.target.checked })} />
            <Label htmlFor="gstfree" className="font-normal">Shipping is a GST-free export</Label>
          </div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !form.customerName.trim()}
            onClick={() =>
              onSubmit({
                customerName: form.customerName.trim(),
                customerEmail: form.customerEmail.trim() || null,
                customerPhone: form.customerPhone.trim() || null,
                billingAddress: form.billingAddress.trim() || null,
                shippingAddress: form.shippingAddress.trim() || null,
                packageKey: pkg.key,
                packageLabel: pkg.label,
                plan: "full",
                listCents: pkg.cents,
                discountCents: dollars(form.discount),
                shippingCents: dollars(form.shipping),
                shippingRegion: form.shippingRegion.trim() || null,
                shippingGstInclusive: !form.gstFreeShipping,
                paymentTerms: form.paymentTerms,
                dueDate: form.dueDate || null,
                notes: form.notes.trim() || null,
              })
            }
          >
            {pending ? "Creating…" : "Create invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  invoice, outstanding, onClose, onSubmit, pending,
}: {
  invoice: KitInvoice | null;
  outstanding: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("eft");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  const value = amount === "" ? outstanding / 100 : Number(amount);

  return (
    <Dialog open={!!invoice} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment {invoice ? `, ${invoice.invoice_number}` : ""}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Outstanding: {money(outstanding)}</p>
        <div className="grid gap-3">
          <div><Label>Amount received ($)</Label><Input value={amount} placeholder={(outstanding / 100).toFixed(2)} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eft">EFT / bank transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date received</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
          <div><Label>Bank reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !invoice || !(value > 0)}
            onClick={() =>
              onSubmit({
                invoiceId: invoice!.id,
                amountCents: Math.round(value * 100),
                method,
                paidAt,
                reference: reference.trim() || null,
              })
            }
          >
            {pending ? "Saving…" : "Record payment & issue receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
