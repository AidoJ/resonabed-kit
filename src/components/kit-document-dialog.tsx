import { useMemo, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { KitInvoice, KitPayment } from "@/lib/invoices.functions";
import logoAsset from "@/assets/resonabed-logo.svg.asset.json";

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

const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const DOCUMENT_CSS = `
  .kit-doc {
    --doc-primary: var(--brand-indigo);
    --doc-accent: var(--brand-violet);
    --doc-tint: var(--brand-tint);
    --doc-ink: var(--brand-ink);
    --doc-muted: var(--muted-foreground);
    --doc-border: var(--border);
    --doc-paper: var(--card);
    box-sizing: border-box;
    width: 100%;
    max-width: 794px;
    min-height: 980px;
    margin: 0 auto;
    padding: 50px 54px 42px;
    background: var(--doc-paper);
    color: var(--doc-ink);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .kit-doc *, .kit-doc *::before, .kit-doc *::after { box-sizing: border-box; }
  .kit-doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; }
  .kit-doc-brand { min-width: 0; }
  .kit-doc-logo { display: block; width: 238px; height: 64px; object-fit: contain; object-position: left center; }
  .kit-doc-seller { margin-top: 8px; color: var(--doc-muted); font-size: 10px; white-space: pre-line; }
  .kit-doc-title { flex: 0 0 auto; text-align: right; }
  .kit-doc-title h1 { margin: 0; color: var(--doc-primary); font-size: 28px; line-height: 1; letter-spacing: 0; text-transform: uppercase; }
  .kit-doc-number { margin-top: 9px; color: var(--doc-accent); font-size: 14px; font-weight: 700; }
  .kit-doc-status { display: inline-block; margin-top: 7px; padding: 3px 8px; border: 1px solid var(--doc-accent); color: var(--doc-primary); font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .kit-doc-rule { height: 4px; margin: 27px 0 20px; background: var(--doc-primary); }
  .kit-doc-meta { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--doc-border); }
  .kit-doc-panel + .kit-doc-panel { border-left: 1px solid var(--doc-border); }
  .kit-doc-panel-title { padding: 8px 11px; background: var(--doc-tint); color: var(--doc-primary); font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .kit-doc-panel-body { min-height: 118px; padding: 11px; }
  .kit-doc-name { margin-bottom: 5px; font-size: 13px; font-weight: 700; }
  .kit-doc-address { white-space: pre-line; }
  .kit-doc-line { margin-top: 3px; color: var(--doc-muted); overflow-wrap: anywhere; }
  .kit-doc-facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
  .kit-doc-facts-after-address { margin-top: 12px; }
  .kit-doc-facts dt { color: var(--doc-muted); font-weight: 700; }
  .kit-doc-facts dd { margin: 0; text-align: right; }
  .kit-doc-table { width: 100%; margin-top: 22px; border-collapse: collapse; table-layout: fixed; }
  .kit-doc-table th { padding: 9px 10px; border: 1px solid var(--doc-border); background: var(--doc-primary); color: var(--primary-foreground); font-size: 10px; text-align: left; text-transform: uppercase; }
  .kit-doc-table th:last-child, .kit-doc-table td:last-child { width: 150px; text-align: right; }
  .kit-doc-table td { padding: 10px; border: 1px solid var(--doc-border); vertical-align: top; }
  .kit-doc-item-note { margin-top: 2px; color: var(--doc-muted); font-size: 10px; }
  .kit-doc-summary { width: 310px; margin: 0 0 0 auto; border-collapse: collapse; }
  .kit-doc-summary td { padding: 7px 10px; border-right: 1px solid var(--doc-border); border-bottom: 1px solid var(--doc-border); border-left: 1px solid var(--doc-border); }
  .kit-doc-summary td:last-child { width: 130px; text-align: right; }
  .kit-doc-summary-total td { border-color: var(--doc-primary); background: var(--doc-primary); color: var(--primary-foreground); font-size: 13px; font-weight: 700; }
  .kit-doc-payment { margin-top: 22px; padding: 13px 15px; border-left: 4px solid var(--doc-accent); background: var(--doc-tint); }
  .kit-doc-payment-title { margin-bottom: 5px; color: var(--doc-primary); font-weight: 700; text-transform: uppercase; }
  .kit-doc-payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; }
  .kit-doc-notes { margin-top: 13px; color: var(--doc-muted); font-size: 10px; }
  .kit-doc-footer { margin-top: 34px; padding-top: 15px; border-top: 1px solid var(--doc-border); }
  .kit-doc-thanks { color: var(--doc-accent); font-size: 15px; font-weight: 700; }
  .kit-doc-footer-details { margin-top: 8px; color: var(--doc-muted); font-size: 10px; }
  @media (max-width: 640px) {
    .kit-doc { min-width: 680px; }
  }
  @media print {
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: var(--doc-paper); print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .kit-doc { min-height: 0; max-width: none; width: 210mm; padding: 14mm 15mm 12mm; }
  }
`;

function printNode(id: string, title: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) return;

  const rootStyles = getComputedStyle(document.documentElement);
  const variables = [
    "--brand-indigo",
    "--brand-violet",
    "--brand-tint",
    "--brand-ink",
    "--muted-foreground",
    "--border",
    "--card",
    "--primary-foreground",
  ]
    .map((name) => `${name}:${rootStyles.getPropertyValue(name).trim()}`)
    .join(";");

  printWindow.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>:root{${variables}}</style></head><body>${node.outerHTML}</body></html>`,
  );
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

function DetailLine({ children }: { children: ReactNode }) {
  return <div className="kit-doc-line">{children}</div>;
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
  const isReceipt = Boolean(payment);

  const lines = useMemo(() => {
    if (!invoice) return [];
    const rows: { label: string; note?: string; amount: number }[] = [
      {
        label: invoice.package_label,
        note: invoice.plan === "installments" ? "10-month payment plan" : "Paid in full",
        amount: invoice.list_cents,
      },
    ];
    if (invoice.discount_cents > 0) {
      rows.push({ label: "Package discount", amount: -invoice.discount_cents });
    }
    if (invoice.shipping_cents > 0) {
      rows.push({
        label: "Shipping",
        note: `${invoice.shipping_region?.toUpperCase() ?? "Delivery"}${invoice.shipping_gst_inclusive ? " · GST inclusive" : " · GST-free export"}`,
        amount: invoice.shipping_cents,
      });
    }
    return rows;
  }, [invoice]);

  if (!invoice) return null;

  const documentNumber = isReceipt ? payment?.receipt_number : invoice.invoice_number;
  const documentTitle = isReceipt ? "Receipt" : "Tax invoice";
  const issuedLabel = isReceipt ? "Payment date" : "Issue date";
  const issuedDate = isReceipt ? payment?.paid_at : invoice.created_at;
  const subtotalExGst = Math.max(0, invoice.total_cents - invoice.gst_cents);
  const sellerName = profile.businessName || "ResonaBed";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-5xl bg-muted p-3 sm:p-5">
        <DialogTitle className="sr-only">{documentTitle} {documentNumber}</DialogTitle>
        <div className="flex justify-end pr-9">
          <Button
            size="sm"
            variant="outline"
            onClick={() => printNode(domId, `${documentTitle} ${documentNumber ?? ""}`)}
          >
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        <div className="overflow-x-auto rounded-sm shadow-soft">
          <article id={domId} className="kit-doc" aria-label={`${documentTitle} ${documentNumber ?? ""}`}>
            <style>{DOCUMENT_CSS}</style>
            <header className="kit-doc-header">
              <div className="kit-doc-brand">
                <img
                  className="kit-doc-logo"
                  src={logoAsset.url}
                  alt="ResonaBed"
                  width="238"
                  height="64"
                />
                <div className="kit-doc-seller">
                  {[sellerName, profile.abn ? `ABN ${profile.abn}` : "", profile.address, profile.email]
                    .filter(Boolean)
                    .join("\n")}
                </div>
              </div>
              <div className="kit-doc-title">
                <h1>{documentTitle}</h1>
                <div className="kit-doc-number">#{documentNumber}</div>
                <div className="kit-doc-status">{isReceipt ? "Paid" : invoice.status}</div>
              </div>
            </header>

            <div className="kit-doc-rule" />

            <section className="kit-doc-meta">
              <div className="kit-doc-panel">
                <div className="kit-doc-panel-title">Bill to</div>
                <div className="kit-doc-panel-body">
                  <div className="kit-doc-name">{invoice.business_name || invoice.customer_name}</div>
                  {invoice.business_name && invoice.customer_name && (
                    <DetailLine>Attn: {invoice.customer_name}</DetailLine>
                  )}
                  {invoice.abn && <DetailLine>ABN {invoice.abn}</DetailLine>}
                  {invoice.billing_address && <DetailLine><span className="kit-doc-address">{invoice.billing_address}</span></DetailLine>}
                  {invoice.customer_email && <DetailLine>{invoice.customer_email}</DetailLine>}
                  {invoice.customer_phone && <DetailLine>{invoice.customer_phone}</DetailLine>}
                </div>
              </div>
              <div className="kit-doc-panel">
                <div className="kit-doc-panel-title">{invoice.shipping_address ? "Ship to" : "Document details"}</div>
                <div className="kit-doc-panel-body">
                  {invoice.shipping_address && (
                    <>
                      <div className="kit-doc-name">{invoice.customer_name}</div>
                      <DetailLine><span className="kit-doc-address">{invoice.shipping_address}</span></DetailLine>
                    </>
                  )}
                  <dl className={`kit-doc-facts${invoice.shipping_address ? " kit-doc-facts-after-address" : ""}`}>
                    <dt>{issuedLabel}</dt><dd>{date(issuedDate)}</dd>
                    {!isReceipt && <><dt>Payment due</dt><dd>{date(invoice.due_date)}</dd></>}
                    <dt>Payment method</dt><dd>{(payment?.method ?? invoice.payment_terms).toUpperCase()}</dd>
                    {isReceipt && <><dt>Related invoice</dt><dd>{invoice.invoice_number}</dd></>}
                  </dl>
                </div>
              </div>
            </section>

            <table className="kit-doc-table">
              <thead>
                <tr><th>Description</th><th>Amount ({invoice.currency})</th></tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={`${line.label}-${line.note ?? ""}`}>
                    <td>
                      <strong>{line.label}</strong>
                      {line.note && <div className="kit-doc-item-note">{line.note}</div>}
                    </td>
                    <td>{money(line.amount, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="kit-doc-summary" aria-label="Invoice totals">
              <tbody>
                <tr><td>Subtotal (ex GST)</td><td>{money(subtotalExGst, invoice.currency)}</td></tr>
                <tr><td>GST included</td><td>{money(invoice.gst_cents, invoice.currency)}</td></tr>
                <tr className="kit-doc-summary-total">
                  <td>{isReceipt ? "Invoice total" : "Total"}</td>
                  <td>{money(invoice.total_cents, invoice.currency)}</td>
                </tr>
                {isReceipt && payment && (
                  <tr><td><strong>Amount received</strong></td><td><strong>{money(payment.amount_cents, invoice.currency)}</strong></td></tr>
                )}
              </tbody>
            </table>

            {isReceipt && payment ? (
              <section className="kit-doc-payment">
                <div className="kit-doc-payment-title">Payment received</div>
                <div className="kit-doc-payment-grid">
                  <span>Method: {payment.method.toUpperCase()}</span>
                  <span>GST component: {money(payment.gst_cents, invoice.currency)}</span>
                  {payment.reference && <span>Reference: {payment.reference}</span>}
                </div>
                {payment.notes && <div className="kit-doc-notes">{payment.notes}</div>}
              </section>
            ) : invoice.payment_terms === "eft" ? (
              <section className="kit-doc-payment">
                <div className="kit-doc-payment-title">Payment by bank transfer</div>
                <div className="kit-doc-payment-grid">
                  <span>Account name: {profile.accountName || "—"}</span>
                  <span>Bank: {profile.bankName || "—"}</span>
                  <span>BSB: {profile.bsb || "—"}</span>
                  <span>Account number: {profile.accountNumber || "—"}</span>
                  <span>Reference: {invoice.invoice_number}</span>
                </div>
              </section>
            ) : (
              <section className="kit-doc-payment">
                <div className="kit-doc-payment-title">Payment details</div>
                <div>Payable securely by card through the ResonaBed website.</div>
              </section>
            )}

            {invoice.notes && <div className="kit-doc-notes">{invoice.notes}</div>}

            <footer className="kit-doc-footer">
              <div className="kit-doc-thanks">Thank you for choosing ResonaBed.</div>
              <div className="kit-doc-footer-details">
                {[sellerName, profile.abn ? `ABN ${profile.abn}` : "", profile.email]
                  .filter(Boolean)
                  .join("  ·  ")}
              </div>
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}