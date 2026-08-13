import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePromoCode } from "@/lib/checkout.functions";
import { CheckCircle2, Tag } from "lucide-react";

type Applied = {
  code: string;
  percentOff: number;
  originalAmount: number;
  amountDiscounted: number;
  payableAmount: number;
};

export function PromoStepDialog({
  open,
  packageKey,
  packagePrice,
  onCancel,
  onContinue,
}: {
  open: boolean;
  packageKey: "pro" | "premium" | "home" | null;
  packagePrice: string;
  onCancel: () => void;
  onContinue: (promoCode: string) => void;
}) {
  const validate = useServerFn(validatePromoCode);
  const [mode, setMode] = useState<"ask" | "enter">("ask");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("ask");
      setCode("");
      setApplied(null);
      setError(null);
      setBusy(false);
    }
  }, [open, packageKey]);

  const handleApply = async () => {
    if (!packageKey || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await validate({ data: { package: packageKey, promoCode: code.trim() } });
      setApplied(result);
    } catch (err) {
      setApplied(null);
      setError(err instanceof Error ? err.message : "Could not validate that code");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} AUD`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-brand-indigo">Do you have a promo code?</DialogTitle>
        </DialogHeader>

        {mode === "ask" && !applied ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Promo codes apply to pay-in-full orders only. Your order total is{" "}
              <span className="font-medium text-foreground">{packagePrice}</span> incl. GST.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setMode("enter")}
                className="h-11 w-full rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
              >
                <Tag className="mr-2 h-4 w-4" />
                Yes, I have a code
              </Button>
              <Button
                onClick={() => onContinue("")}
                variant="outline"
                className="h-11 w-full rounded-full border-brand-indigo/25 text-brand-indigo hover:bg-brand-tint"
              >
                No, continue to payment
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "enter" && !applied ? (
          <div className="space-y-4 pt-2">
            <Input
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              placeholder="ENTER CODE"
              maxLength={40}
              className="h-11 rounded-full text-center uppercase tracking-widest border-brand-indigo/25"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                onClick={handleApply}
                disabled={busy || !code.trim()}
                className="h-11 flex-1 rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
              >
                {busy ? "Checking…" : "Apply code"}
              </Button>
              <Button
                onClick={() => onContinue("")}
                variant="ghost"
                className="h-11 rounded-full text-muted-foreground"
              >
                Skip
              </Button>
            </div>
          </div>
        ) : null}

        {applied ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{applied.code} applied, {applied.percentOff}% off</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Original</dt>
                  <dd className="line-through">{fmt(applied.originalAmount)}</dd>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <dt>Discount</dt>
                  <dd>− {fmt(applied.amountDiscounted)}</dd>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2 font-medium text-brand-indigo">
                  <dt>You pay</dt>
                  <dd>{fmt(applied.payableAmount)}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onContinue(applied.code)}
                className="h-11 flex-1 rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
              >
                Continue to payment
              </Button>
              <Button
                onClick={() => { setApplied(null); setCode(""); setMode("enter"); }}
                variant="ghost"
                className="h-11 rounded-full text-muted-foreground"
              >
                Change code
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
