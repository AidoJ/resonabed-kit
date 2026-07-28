import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Loader2 } from "lucide-react";

export type EftContactDetails = { email: string; phone: string };

export function PaymentMethodStepDialog({
  open,
  price,
  submitting,
  onCancel,
  onCard,
  onEft,
}: {
  open: boolean;
  price: string;
  submitting?: boolean;
  onCancel: () => void;
  onCard: () => void;
  onEft: (contact: EftContactDetails) => void;
}) {
  const [mode, setMode] = useState<"choose" | "eft">("choose");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const close = () => {
    setMode("choose");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-brand-indigo">How would you like to pay?</DialogTitle>
          <DialogDescription>
            Paying in full ({price} AUD incl. GST, plus shipping). Choose card for instant checkout,
            or request a tax invoice and pay by bank transfer.
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onCard}
              className="flex w-full items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-brand-indigo/40 hover:bg-brand-tint"
            >
              <CreditCard className="mt-0.5 h-5 w-5 text-brand-violet-strong" />
              <span>
                <span className="block text-sm font-medium text-foreground">Credit or debit card</span>
                <span className="block text-xs text-muted-foreground">
                  Secure checkout by Stripe. Order confirmed immediately.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode("eft")}
              className="flex w-full items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-brand-indigo/40 hover:bg-brand-tint"
            >
              <Banknote className="mt-0.5 h-5 w-5 text-brand-violet-strong" />
              <span>
                <span className="block text-sm font-medium text-foreground">Invoice / EFT bank transfer</span>
                <span className="block text-xs text-muted-foreground">
                  We raise a numbered tax invoice with our bank details. Kit ships once funds clear.
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eft-email">Email for the invoice</Label>
              <Input
                id="eft-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com.au"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eft-phone">Phone (optional)</Label>
              <Input
                id="eft-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="04xx xxx xxx"
              />
            </div>
            <div className="flex justify-between gap-3 pt-1">
              <Button variant="ghost" onClick={() => setMode("choose")} disabled={submitting}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => onEft({ email: email.trim(), phone: phone.trim() })}
                disabled={!emailOk || submitting}
                className="rounded-full px-6"
              >
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Request invoice
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type EftInvoiceResult = {
  invoiceNumber: string;
  totalCents: number;
  gstCents: number;
  dueDate: string | null;
  shippingLabel: string;
  bank: {
    businessName: string;
    bankName: string;
    bsb: string;
    accountNumber: string;
    accountName: string;
    email: string;
  };
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

export function EftInvoiceDialog({
  result,
  onClose,
}: {
  result: EftInvoiceResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!result} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-indigo">
            <CheckCircle2 className="h-5 w-5 text-brand-violet-strong" />
            Invoice {result?.invoiceNumber} raised
          </DialogTitle>
          <DialogDescription>
            Transfer the total below using the invoice number as your payment reference. We'll email
            a copy of the tax invoice and confirm dispatch once funds clear.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-border p-4">
              <Row label="Amount due" value={money(result.totalCents)} strong />
              <Row label="Includes GST" value={money(result.gstCents)} />
              <Row label="Shipping" value={result.shippingLabel} />
              {result.dueDate ? <Row label="Due by" value={result.dueDate} /> : null}
            </div>
            <div className="rounded-2xl border border-border bg-brand-tint/60 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-indigo">
                Bank transfer details
              </p>
              <Row label="Account name" value={result.bank.accountName || result.bank.businessName} />
              <Row label="Bank" value={result.bank.bankName || "—"} />
              <Row label="BSB" value={result.bank.bsb || "—"} />
              <Row label="Account number" value={result.bank.accountNumber || "—"} />
              <Row label="Reference" value={result.invoiceNumber} strong />
            </div>
            <p className="text-xs text-muted-foreground">
              Questions? Email {result.bank.email || "info@resonabed.com"}.
            </p>
            <Button className="h-11 w-full rounded-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}
