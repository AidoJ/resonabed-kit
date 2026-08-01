import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getShippingRates, type ShippingRateRow } from "@/lib/shipping.functions";
import { getGoogleMapsBrowserConfig } from "@/lib/google-maps.functions";
import { CheckCircle2, Loader2, MapPin, PackageCheck, Search, Truck } from "lucide-react";

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

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GooglePlaceSuggestion = {
  placePrediction?: {
    text?: { text?: string };
    toPlace: () => {
      formattedAddress?: string;
      addressComponents?: GoogleAddressComponent[];
      fetchFields: (request: { fields: string[] }) => Promise<void>;
    };
  };
};

declare global {
  interface Window {
    google?: any;
    __resonabedGoogleMapsReady?: () => void;
  }
}

let googleMapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise<void>((resolve, reject) => {
    window.__resonabedGoogleMapsReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=__resonabedGoogleMapsReady`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not be loaded"));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

const componentText = (component: GoogleAddressComponent, short = false) =>
  (short ? component.shortText || component.short_name : component.longText || component.long_name) || "";

const findComponent = (components: GoogleAddressComponent[], type: string) =>
  components.find((component) => component.types?.includes(type));

function parseGoogleAddress(components: GoogleAddressComponent[], fallbackLine1: string): EnteredShippingAddress {
  const streetNumber = componentText(findComponent(components, "street_number") ?? {});
  const route = componentText(findComponent(components, "route") ?? {});
  const premise = componentText(findComponent(components, "premise") ?? {});
  const subpremise = componentText(findComponent(components, "subpremise") ?? {});
  const city =
    componentText(findComponent(components, "locality") ?? {}) ||
    componentText(findComponent(components, "postal_town") ?? {}) ||
    componentText(findComponent(components, "sublocality_level_1") ?? {}) ||
    componentText(findComponent(components, "administrative_area_level_2") ?? {});
  const state = componentText(findComponent(components, "administrative_area_level_1") ?? {}, true);
  const postalCode = componentText(findComponent(components, "postal_code") ?? {}, true);
  const postalSuffix = componentText(findComponent(components, "postal_code_suffix") ?? {}, true);
  const country = componentText(findComponent(components, "country") ?? {}, true).toUpperCase();
  const line1 = [streetNumber, route].filter(Boolean).join(" ") || premise || fallbackLine1.split(",")[0] || "";

  return {
    name: "",
    line1,
    line2: subpremise,
    city,
    state,
    postalCode: postalSuffix ? `${postalCode}-${postalSuffix}` : postalCode,
    country,
  };
}

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
  const fetchMapsConfig = useServerFn(getGoogleMapsBrowserConfig);
  const { data: rates, isLoading } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: () => fetchRates(),
    enabled: open,
    staleTime: 60_000,
  });
  const [pickup, setPickup] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressVerified, setAddressVerified] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const searchRequestRef = useRef(0);
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

  const { data: mapsConfig } = useQuery({
    queryKey: ["google-maps-browser-config"],
    queryFn: () => fetchMapsConfig(),
    enabled: open && !pickup,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (open) {
      setPickup(false);
      setAddressQuery("");
      setAddressVerified(false);
      setSuggestions([]);
      setPlacesError(null);
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

  useEffect(() => {
    if (!open || pickup || !mapsConfig?.apiKey) return;
    let cancelled = false;
    setPlacesError(null);
    loadGoogleMaps(mapsConfig.apiKey)
      .then(async () => {
        await window.google.maps.importLibrary("places");
        if (cancelled) return;
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        setPlacesReady(true);
      })
      .catch(() => {
        if (!cancelled) setPlacesError("Address search is unavailable. Please try again shortly.");
      });
    return () => {
      cancelled = true;
    };
  }, [mapsConfig?.apiKey, open, pickup]);

  useEffect(() => {
    if (!open || pickup || !placesReady || countryOptions.length === 0 || addressQuery.trim().length < 4) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const places = await window.google.maps.importLibrary("places");
        const regionCodes = countryOptions.map((country) => country.code.toLowerCase());
        const request: Record<string, unknown> = {
          input: addressQuery,
          sessionToken: sessionTokenRef.current,
        };
        // Places API (New) allows at most 15 included_region_codes.
        if (regionCodes.length > 0 && regionCodes.length <= 15) {
          request.includedRegionCodes = regionCodes;
        }
        const { suggestions: nextSuggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (searchRequestRef.current === requestId) {
          setSuggestions((nextSuggestions ?? []).filter((suggestion: GooglePlaceSuggestion) => suggestion.placePrediction));
          setIsSearching(false);
        }
      } catch {
        if (searchRequestRef.current === requestId) {
          setSuggestions([]);
          setIsSearching(false);
          setPlacesError("Address search is unavailable. Please try again shortly.");
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [addressQuery, countryOptions, open, pickup, placesReady]);

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
    if (!addressVerified) return setError("Choose an address from the Google address suggestions.");
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

  const handleSuggestionSelect = async (suggestion: GooglePlaceSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
      const formattedAddress = place.formattedAddress || prediction.text?.text || "";
      const parsed = parseGoogleAddress(place.addressComponents ?? [], formattedAddress);
      const nextForm = {
        ...parsed,
        name: form.name,
        line2: parsed.line2 || form.line2,
      };
      setForm(nextForm);
      setAddressQuery(formattedAddress);
      setSuggestions([]);
      setAddressVerified(Boolean(nextForm.line1 && nextForm.city && nextForm.postalCode && nextForm.country));
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();

      const shipsToCountry = shippableRates.some((rate) =>
        rate.allowed_countries.map((country) => country.toUpperCase()).includes(nextForm.country),
      );
      if (!shipsToCountry) {
        setError("We don't ship to that country yet.");
      } else if (!nextForm.line1 || !nextForm.city || !nextForm.postalCode || !nextForm.country) {
        setError("Choose a more precise address that includes street, city, postcode, and country.");
      } else {
        setError(null);
      }
    } catch {
      setError("That address could not be read. Please choose another suggestion.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-indigo">
            <Truck className="h-5 w-5" />
            Where should we ship your kit?
          </DialogTitle>
          <DialogDescription>
            Search for a verified delivery address or choose customer pickup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-start justify-between rounded-2xl border border-brand-indigo/15 bg-brand-tint/60 p-3">
            <div className="flex items-start gap-2">
              <PackageCheck className="mt-0.5 h-4 w-4 text-brand-indigo" />
              <div>
                <div className="text-sm font-medium text-brand-indigo">I'll collect in person</div>
                <div className="text-xs text-muted-foreground">
                  No delivery, arrange pickup with us directly. No shipping charge.
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
                    <div className="relative">
                      <Label htmlFor="ship-address-search">Delivery address</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="ship-address-search"
                          value={addressQuery}
                          disabled={!mapsConfig?.configured || Boolean(placesError)}
                          onChange={(e) => {
                            setAddressQuery(e.target.value);
                            setAddressVerified(false);
                            setForm((f) => ({ ...f, line1: "", city: "", state: "", postalCode: "", country: "" }));
                          }}
                          placeholder={placesReady ? "Start typing a street address…" : "Loading address search…"}
                          className="pl-9"
                          autoComplete="off"
                        />
                        {isSearching ? (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : addressVerified ? (
                          <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                        ) : null}
                      </div>
                      {!mapsConfig?.configured ? (
                        <p className="mt-1 text-xs text-destructive">Address search is not configured.</p>
                      ) : placesError ? (
                        <p className="mt-1 text-xs text-destructive">{placesError}</p>
                      ) : null}
                      {suggestions.length > 0 ? (
                        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-brand-indigo/15 bg-white py-1 shadow-lg">
                          {suggestions.map((suggestion, index) => {
                            const text = suggestion.placePrediction?.text?.text ?? "Address suggestion";
                            return (
                              <button
                                key={`${text}-${index}`}
                                type="button"
                                onClick={() => void handleSuggestionSelect(suggestion)}
                                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-brand-indigo hover:bg-brand-tint"
                              >
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-violet" />
                                <span>{text}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    {addressVerified ? (
                      <div className="rounded-2xl border border-brand-indigo/15 bg-brand-tint/50 p-3 text-sm text-brand-indigo">
                        <div className="font-medium">Verified address</div>
                        <div className="mt-1 text-muted-foreground">
                          {form.line1}
                          {form.line2 ? `, ${form.line2}` : ""}, {form.city}
                          {form.state ? `, ${form.state}` : ""} {form.postalCode}, {countryName(form.country)}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <Label htmlFor="ship-line2">Unit / suite (optional)</Label>
                      <Input
                        id="ship-line2"
                        value={form.line2}
                        onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                      />
                    </div>
                    <div className="hidden">
                      <Label htmlFor="ship-line1">Address line 1</Label>
                      <Input
                        id="ship-line1"
                        value={form.line1}
                        readOnly
                      />
                    </div>
                    <div className="hidden grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ship-city">City / Suburb</Label>
                        <Input
                          id="ship-city"
                          value={form.city}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label htmlFor="ship-state">State / Province</Label>
                        <Input
                          id="ship-state"
                          value={form.state}
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="hidden grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ship-postal">Postal / ZIP</Label>
                        <Input
                          id="ship-postal"
                          value={form.postalCode}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label htmlFor="ship-country">Country</Label>
                        <Input id="ship-country" value={form.country} readOnly />
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
                          Shipping, {matchedRate.label}
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
                <span>Shipping, pickup</span>
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
              disabled={!pickup && (!addressVerified || !form.country || !matchedRate)}
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
