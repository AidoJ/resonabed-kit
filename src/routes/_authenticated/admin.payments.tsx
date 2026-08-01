import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listKitInvoices, deleteKitPayment, type KitPayment } from "@/lib/invoices.functions";
import { getBillingProfile, EMPTY_BILLING_PROFILE } from "@/lib/billing-profile.functions";
import { KitDocumentDialog } from "@/components/kit-document-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Kit payments, Admin, ResonaBed" },
      { name: "description", content: "Payments received against ResonaBed kit invoices, with printable receipts." },
    ],
  }),
  component: PaymentsAdmin,
});

const money = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function PaymentsAdmin() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listKitInvoices);
  const fetchProfile = useServerFn(getBillingProfile);
  const removePayment = useServerFn(deleteKitPayment);

  const { data, isLoading, error } = useQuery({ queryKey: ["kit-invoices"], queryFn: () => fetchAll() });
  const { data: profile } = useQuery({ queryKey: ["billing-profile"], queryFn: () => fetchProfile() });
  const [viewing, setViewing] = useState<KitPayment | null>(null);

  const deleteMut = useMutation({
    mutationFn: (input: Parameters<typeof removePayment>[0]) => removePayment(input),
    onSuccess: () => { toast.success("Payment removed"); qc.invalidateQueries({ queryKey: ["kit-invoices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading payments…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load payments: {(error as Error).message}</p>;

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const invoiceOf = (id: string) => invoices.find((i) => i.id === id) ?? null;

  const received = payments.reduce((a, p) => a + p.amount_cents, 0);
  const gst = payments.reduce((a, p) => a + p.gst_cents, 0);
  const eft = payments.filter((p) => p.method === "eft").reduce((a, p) => a + p.amount_cents, 0);
  const outstanding = invoices
    .filter((i) => i.status !== "void")
    .reduce((a, i) => {
      const paid = payments.filter((p) => p.invoice_id === i.id).reduce((s, p) => s + p.amount_cents, 0);
      return a + Math.max(0, i.total_cents - paid);
    }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Payments received</h2>
        <p className="text-sm text-muted-foreground">
          Every payment recorded against a kit invoice, each with a numbered receipt you can print
          or save as PDF.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Receipts" value={String(payments.length)} />
        <Stat label="Received" value={money(received)} hint="Across all invoices" />
        <Stat label="Via EFT" value={money(eft)} hint="Bank transfers" />
        <Stat label="Outstanding" value={money(outstanding)} hint="Unpaid invoice balances" />
      </div>
      <div className="text-xs text-muted-foreground">GST component of receipts: {money(gst)}</div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  No payments recorded yet. Record one from the Invoices tab.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => {
                const inv = invoiceOf(p.invoice_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap font-medium">{p.receipt_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(p.paid_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{inv?.invoice_number ?? "—"}</TableCell>
                    <TableCell>{inv?.customer_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="uppercase text-xs">{p.method}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">{money(p.amount_cents)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(p.gst_cents)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setViewing(p)}>
                          <ReceiptIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm(`Delete receipt ${p.receipt_number}?`)) deleteMut.mutate({ data: { id: p.id } }); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <KitDocumentDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        invoice={viewing ? invoiceOf(viewing.invoice_id) : null}
        payment={viewing}
        profile={profile ?? EMPTY_BILLING_PROFILE}
      />
    </div>
  );
}
