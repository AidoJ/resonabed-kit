import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { KitInvoice, KitPayment } from "@/lib/invoices.functions";

export type BillingProfile = {
  businessName: string;
  abn: string;
  address: string;
  email: string;
  bankName: string;
  bsb: string;
  accountNumber: string;
  accountName: string;
};

const money = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

const date = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function printNode(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(
    `<html><head><title>Print</title><style>
      body{font-family:ui-sans-serif,system-ui,sans-serif;color:#1a1a2e;padding:32px;}
      h1{font-size:22px;margin:0 0 4px;color:#26106c}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th,td{padding:8px;border-bottom:1px solid #e5e5ef;text-align:left}
      td.r,th.r{text-align:right}
      .muted{color:#666;font-size:12px}
      .box{background:#f6f5fb;padding:12px;border-radius:8px;font-size:12px;margin-top:16px}
    </style></head><body>${node.innerHTML}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

export function KitDocumentDialog({
  open,
  onClose,
  invoice,
  payment,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  invoice: KitInvoice | null;
  /** When supplied the document renders as a receipt for that payment. */
  payment?: KitPayment | null;
  profile: BillingProfile;
}) {
  const domId = "kit-doc-print";
  const isReceipt = !!payment;

  const lines = useMemo(() => {
    if (!invoice) return [];
    const rows: { label: string; amount: number }[] = [
      { label: `${invoice.package_label} (${invoice.plan === "installments" ? "payment plan" : "paid in full"})`, amount: invoice.list_cents },
    ];
    if (invoice.discount_cents > 0) rows.push({ label: "Discount", amount: -invoice.discount_cents });
    if (invoice.shipping_cents > 0)
      rows.push({
        label: `Shipping${invoice.shipping_region ? ` — ${invoice.shipping_region.toUpperCase()}` : ""}${invoice.shipping_gst_inclusive ? "" : " (GST-free export)"}`,
        amount: invoice.shipping_cents,
      });
    return rows;
  }, [invoice]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => printNode(domId)}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        <div id={domId} className="mt-2 text-sm">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
            <div>
              <h1>{isReceipt ? "Receipt" : "Tax Invoice"}</h1>
              <div className="muted">
                {isReceipt ? payment!.receipt_number : invoice.invoice_number}
                {isReceipt ? ` · for ${invoice.invoice_number}` : ""}
              </div>
              <div className="muted">
                {isReceipt ? `Paid ${date(payment!.paid_at)}` : `Issued ${date(invoice.created_at)}`}
              </div>
              {!isReceipt && <div className="muted">Due {date(invoice.due_date)}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>{profile.businessName || "ResonaBed"}</strong>
              {profile.abn && <div className="muted">ABN {profile.abn}</div>}
              {profile.address && <div className="muted">{profile.address}</div>}
              {profile.email && <div className="muted">{profile.email}</div>}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="muted">Bill to</div>
            <div><strong>{invoice.customer_name}</strong></div>
            {invoice.customer_email && <div className="muted">{invoice.customer_email}</div>}
            {invoice.customer_phone && <div className="muted">{invoice.customer_phone}</div>}
            {invoice.billing_address && <div className="muted">{invoice.billing_address}</div>}
            {invoice.shipping_address && (
              <div className="muted">Ship to: {invoice.shipping_address}</div>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="r">Amount ({invoice.currency})</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td className="r">{money(l.amount, invoice.currency)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total (incl. GST)</strong></td>
                <td className="r"><strong>{money(invoice.total_cents, invoice.currency)}</strong></td>
              </tr>
              <tr>
                <td>GST included</td>
                <td className="r">{money(invoice.gst_cents, invoice.currency)}</td>
              </tr>
              {isReceipt && (
                <tr>
                  <td><strong>Amount received ({payment!.method.toUpperCase()})</strong></td>
                  <td className="r"><strong>{money(payment!.amount_cents, invoice.currency)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>

          {isReceipt ? (
            <div className="box">
              Payment received{payment!.reference ? ` · reference ${payment!.reference}` : ""}. GST
              component of this payment: {money(payment!.gst_cents, invoice.currency)}.
              {payment!.notes ? ` ${payment!.notes}` : ""}
            </div>
          ) : invoice.payment_terms === "eft" ? (
            <div className="box">
              <strong>Pay by EFT (bank transfer)</strong>
              <div>Account name: {profile.accountName || "—"}</div>
              <div>Bank: {profile.bankName || "—"}</div>
              <div>BSB: {profile.bsb || "—"}</div>
              <div>Account number: {profile.accountNumber || "—"}</div>
              <div>Reference: {invoice.invoice_number}</div>
            </div>
          ) : (
            <div className="box">Payable by card via the ResonaBed website checkout.</div>
          )}

          {invoice.notes && <div className="muted" style={{ marginTop: 12 }}>{invoice.notes}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
