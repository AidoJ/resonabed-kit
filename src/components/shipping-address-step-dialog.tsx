import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getShippingRates, type ShippingRateRow } from "@/lib/shipping.functions";
import { Truck, PackageCheck } from "lucide-react";

export type EnteredShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // 2-letter ISO
};

export type ShippingContinuePayload =
  | { pickup: true }
  | { pickup: false; address: EnteredShippingAddress };

// Minimal country name lookup for the ISO codes in our rates.
const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  BE: "Belgium",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  CH: "Switzerland",
  AT: "Austria",
  PL: "Poland",
};

const countryName = (iso: string) => COUNTRY_NAMES[iso] ?? iso;

export function ShippingAddressStepDialog({
  open,
  packagePriceCents,
  onCancel,
  onContinue,
}: {
  open: boolean;
  packagePriceCents: number;
  onCancel: () => void;
  onContinue: (payload: ShippingContinuePayload) => void;
}) {
  const fetchRates = useServerFn(getShippingRates);
  const { data: rates, isLoading } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: () => fetchRates(),
    enabled: open,
    staleTime: 60_000,
  });

  const [pickup, setPickup] = useState(false);
  const [form, setForm] = useState<EnteredShippingAddress>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPickup(false);
      setForm({ name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "" });
      setError(null);
    }
  }, [open]);

  // Shippable rows only (excludes pickup / $0). Pickup is handled by the toggle.
  const shippableRates = useMemo<ShippingRateRow[]>(
    () => (rates ?? []).filter((r) => r.amount_cents > 0),
    [rates],
  );

  const countryOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { code: string; name: string }[] = [];
    for (const r of shippableRates) {
      for (const c of r.allowed_countries) {
        const iso = c.toUpperCase();
        if (seen.has(iso)) continue;
        seen.add(iso);
        opts.push({ code: iso, name: countryName(iso) });
      }
    }
    opts.sort((a, b) => a.name.localeCompare(b.name));
    return opts;
  }, [shippableRates]);

  // Match country → rate by lowest sort_order tiebreaker (rates already sorted).
  const matchedRate = useMemo<ShippingRateRow | null>(() => {
    if (!form.country) return null;
    return (
      shippableRates.find((r) => r.allowed_countries.map((c) => c.toUpperCase()).includes(form.country)) ??
      null
    );
  }, [shippableRates, form.country]);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} AUD`;

  const shippingCents = pickup ? 0 : matchedRate?.amount_cents ?? 0;
  const totalCents = packagePriceCents + shippingCents;

  const handleContinue = () => {
    if (pickup) {
      onContinue({ pickup: true });
      return;
    }
    if (!form.country) return setError("Select a destination country.");
    if (!matchedRate) return setError("We don't ship to that country yet.");
    if (!form.name.trim()) return setError("Enter the recipient's full name.");
    if (!form.line1.trim()) return setError("Enter the street address.");
    if (!form.city.trim()) return setError("Enter the city / suburb.");
    if (!form.postalCode.trim()) return setError("Enter the postal / ZIP code.");
    setError(null);
    onContinue({
      pickup: false,
      address: {
        name: form.name.trim(),
        line1: form.line1.trim(),
        line2: form.line2?.trim() || undefined,
        city: form.city.trim(),
        state: form.state?.trim() || undefined,
        postalCode: form.postalCode.trim(),
        country: form.country,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-indigo">
            <Truck className="h-5 w-5" />
            Where should we ship your kit?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-start justify-between rounded-2xl border border-brand-indigo/15 bg-brand-tint/60 p-3">
            <div className="flex items-start gap-2">
              <PackageCheck className="mt-0.5 h-4 w-4 text-brand-indigo" />
              <div>
                <div className="text-sm font-medium text-brand-indigo">I'll collect in person</div>
                <div className="text-xs text-muted-foreground">
                  No delivery — arrange pickup with us directly. No shipping charge.
                </div>
              </div>
            </div>
            <Switch checked={pickup} onCheckedChange={setPickup} />
          </div>

          {!pickup ? (
            <>
              {isLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Loading destinations…</p>
              ) : countryOptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-destructive">
                  No shipping regions are available. Please contact info@resonabed.com.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="ship-name">Full name</Label>
                      <Input
                        id="ship-name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ship-line1">Address line 1</Label>
                      <Input
                        id="ship-line1"
                        value={form.line1}
                        onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ship-line2">Address line 2 (optional)</Label>
                      <Input
                        id="ship-line2"
                        value={form.line2}
                        onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ship-city">City / Suburb</Label>
                        <Input
                          id="ship-city"
                          value={form.city}
                          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ship-state">State / Province</Label>
                        <Input
                          id="ship-state"
                          value={form.state}
                          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ship-postal">Postal / ZIP</Label>
                        <Input
                          id="ship-postal"
                          value={form.postalCode}
                          onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ship-country">Country</Label>
                        <Select
                          value={form.country}
                          onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                        >
                          <SelectTrigger id="ship-country">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {countryOptions.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {matchedRate ? (
                    <div className="rounded-2xl border border-brand-indigo/15 bg-white p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Kit</span>
                        <span>{fmt(packagePriceCents)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          Shipping — {matchedRate.label}
                          <span className="ml-1 text-xs">
                            ({matchedRate.gst_inclusive ? "incl. GST" : "GST-free export"})
                          </span>
                        </span>
                        <span>{fmt(matchedRate.amount_cents)}</span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-brand-indigo/10 pt-2 font-medium text-brand-indigo">
                        <span>Order total</span>
                        <span>{fmt(totalCents)}</span>
                      </div>
                    </div>
                  ) : form.country ? (
                    <p className="text-sm text-destructive">We don't ship to that country yet.</p>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-brand-indigo/15 bg-white p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Kit</span>
                <span>{fmt(packagePriceCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping — pickup</span>
                <span>Free</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-brand-indigo/10 pt-2 font-medium text-brand-indigo">
                <span>Order total</span>
                <span>{fmt(totalCents)}</span>
              </div>
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleContinue}
              className="h-11 flex-1 rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
              disabled={!pickup && (!form.country || !matchedRate)}
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
