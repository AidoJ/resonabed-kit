import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getGoogleMapsBrowserConfig } from "@/lib/google-maps.functions";

export type StructuredAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

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
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise<void>((resolve, reject) => {
    window.__resonabedGoogleMapsReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&loading=async&callback=__resonabedGoogleMapsReady`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not be loaded"));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

const text = (c: GoogleAddressComponent | undefined, short = false) =>
  (short ? c?.shortText || c?.short_name : c?.longText || c?.long_name) || "";

const find = (components: GoogleAddressComponent[], type: string) =>
  components.find((c) => c.types?.includes(type));

function parse(components: GoogleAddressComponent[], fallback: string): StructuredAddress {
  const streetNumber = text(find(components, "street_number"));
  const route = text(find(components, "route"));
  const premise = text(find(components, "premise"));
  return {
    line1: [streetNumber, route].filter(Boolean).join(" ") || premise || fallback.split(",")[0] || "",
    line2: text(find(components, "subpremise")),
    city:
      text(find(components, "locality")) ||
      text(find(components, "postal_town")) ||
      text(find(components, "sublocality_level_1")) ||
      text(find(components, "administrative_area_level_2")),
    state: text(find(components, "administrative_area_level_1"), true),
    postcode: text(find(components, "postal_code"), true),
    country: text(find(components, "country"), true).toUpperCase(),
  };
}

export function formatAddress(a: StructuredAddress) {
  return [a.line2, a.line1, a.city, [a.state, a.postcode].filter(Boolean).join(" "), a.country]
    .filter((p) => p && p.trim())
    .join(", ");
}

/**
 * Google Places (New) backed address entry. There are no free-text address
 * fields — an address only becomes set when the operator picks a real place,
 * so what we store is always a valid, structured address.
 */
export function AddressAutocomplete({
  value,
  onChange,
  label = "Clinic address",
  regionCodes = ["au", "nz"],
}: {
  value: StructuredAddress;
  onChange: (next: StructuredAddress) => void;
  label?: string;
  regionCodes?: string[];
}) {
  const fetchMapsConfig = useServerFn(getGoogleMapsBrowserConfig);
  const { data: mapsConfig } = useQuery({
    queryKey: ["google-maps-browser-config"],
    queryFn: () => fetchMapsConfig(),
    staleTime: 10 * 60_000,
  });

  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const sessionTokenRef = useRef<any>(null);
  const requestRef = useRef(0);

  const hasAddress = Boolean(value.line1);

  useEffect(() => {
    if (!mapsConfig?.apiKey) return;
    let cancelled = false;
    loadGoogleMaps(mapsConfig.apiKey)
      .then(async () => {
        await window.google.maps.importLibrary("places");
        if (cancelled) return;
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Address search is unavailable. Please try again shortly.");
      });
    return () => {
      cancelled = true;
    };
  }, [mapsConfig?.apiKey]);

  useEffect(() => {
    if (!ready || query.trim().length < 4) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const id = requestRef.current + 1;
    requestRef.current = id;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const places = await window.google.maps.importLibrary("places");
        const request: Record<string, unknown> = {
          input: query,
          sessionToken: sessionTokenRef.current,
        };
        if (regionCodes.length > 0 && regionCodes.length <= 15) {
          request.includedRegionCodes = regionCodes;
        }
        const { suggestions: next } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (requestRef.current === id) {
          setSuggestions((next ?? []).filter((s: GooglePlaceSuggestion) => s.placePrediction));
          setSearching(false);
        }
      } catch {
        if (requestRef.current === id) {
          setSuggestions([]);
          setSearching(false);
          setError("Address search is unavailable. Please try again shortly.");
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, ready, regionCodes.join(",")]);

  const select = async (suggestion: GooglePlaceSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
      const formatted = place.formattedAddress || prediction.text?.text || "";
      const parsed = parse(place.addressComponents ?? [], formatted);
      if (!parsed.line1 || !parsed.city) {
        setError("Choose a more precise address that includes the street and suburb.");
        return;
      }
      setError(null);
      onChange(parsed);
      setSuggestions([]);
      setQuery("");
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch {
      setError("That address could not be read. Please choose another suggestion.");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="clinic-address-search">{label}</Label>

      {hasAddress ? (
        <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm">{formatAddress(value)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ line1: "", line2: "", city: "", state: "", postcode: "", country: "" })
            }
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="clinic-address-search"
              value={query}
              autoComplete="off"
              disabled={!mapsConfig?.configured || Boolean(error && !ready)}
              placeholder={ready ? "Start typing your street address…" : "Loading address search…"}
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {suggestions.length > 0 ? (
            <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 shadow-lg">
              {suggestions.map((s, i) => {
                const label = s.placePrediction?.text?.text ?? "Address suggestion";
                return (
                  <button
                    key={`${label}-${i}`}
                    type="button"
                    onClick={() => void select(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {!mapsConfig?.configured ? (
        <p className="text-xs text-destructive">Address search is not configured.</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Start typing and pick your address from the list so it&rsquo;s stored accurately.
        </p>
      )}
    </div>
  );
}
