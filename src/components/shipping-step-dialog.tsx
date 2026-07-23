import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getShippingRates } from "@/lib/shipping.functions";
import { Truck } from "lucide-react";

export function ShippingStepDialog({
  open,
  onCancel,
  onContinue,
}: {
  open: boolean;
  onCancel: () => void;
  onContinue: (region: string) => void;
}) {
  const fetchRates = useServerFn(getShippingRates);
  const { data: rates, isLoading } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: () => fetchRates(),
    enabled: open,
    staleTime: 60_000,
  });

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} AUD`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-indigo">
            <Truck className="h-5 w-5" />
            Where should we ship your kit?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Select a destination to see flat-rate shipping. You'll enter the full address at checkout.
          </p>

          {isLoading || !rates ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading rates…</p>
          ) : rates.length === 0 ? (
            <p className="py-6 text-center text-sm text-destructive">
              No shipping regions are currently available. Please contact info@resonabed.com.
            </p>
          ) : (
            <div className="space-y-2">
              {rates.map((r) => {
                const active = selected === r.region;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r.region)}
                    className={
                      "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition " +
                      (active
                        ? "border-brand-indigo bg-brand-tint"
                        : "border-border hover:border-brand-indigo/40")
                    }
                  >
                    <div>
                      <div className="text-sm font-medium text-brand-indigo">{r.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.gst_inclusive ? "Incl. GST" : "Shipped GST-free (export)"}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-foreground">{fmt(r.amount_cents)}</div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => selected && onContinue(selected)}
              disabled={!selected}
              className="h-11 flex-1 rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
            >
              Continue
            </Button>
            <Button
              onClick={onCancel}
              variant="ghost"
              className="h-11 rounded-full text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
