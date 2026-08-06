import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { getOrgSettings, getSignedLogoUrl } from "@/lib/admin.functions";
import { buildPersonalisedFlyer } from "@/lib/flyer-personalise";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import flyerPdf from "@/assets/resonabed-flyer.pdf.asset.json";
import flyerOutside from "@/assets/resonabed-flyer-outside.jpg.asset.json";
import flyerInside from "@/assets/resonabed-flyer-inside.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  head: () => ({ meta: [{ title: "Marketing, ResonaBed" }] }),
  component: MarketingPage,
});

type FieldKey = "name" | "phone" | "email" | "website" | "logo" | "qr";

function MarketingPage() {
  const fetchSettings = useServerFn(getOrgSettings);
  const signLogo = useServerFn(getSignedLogoUrl);

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-settings", "marketing"],
    queryFn: () => fetchSettings(),
  });

  const { data: logo } = useQuery({
    queryKey: ["org-logo-signed", org?.logo_path],
    queryFn: () => signLogo({ data: { path: org!.logo_path as string } }),
    enabled: !!org?.logo_path,
  });

  const [include, setInclude] = useState<Record<FieldKey, boolean>>({
    name: true,
    phone: true,
    email: true,
    website: false,
    logo: false,
    qr: true,
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrPreview, setQrPreview] = useState("");

  // Prefill from clinic settings once loaded, still editable per print run.
  useEffect(() => {
    if (!org) return;
    setName(org.name ?? "");
    setPhone(org.public_contact_phone ?? "");
    setEmail(org.public_contact_email ?? "");
    setWebsite(org.slug ? `resonabed.com/o/${org.slug}` : "");
    setInclude((prev) => ({
      ...prev,
      phone: !!org.public_contact_phone,
      email: !!org.public_contact_email,
      website: !!org.slug,
      qr: !!org.slug,
    }));
  }, [org]);

  const bookingUrl = org?.slug ? `https://resonabed.com/o/${org.slug}` : "";

  // Live preview of the printed QR code.
  useEffect(() => {
    if (!include.qr || !bookingUrl) {
      setQrPreview("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(bookingUrl, {
      margin: 0,
      scale: 6,
      color: { dark: "#26106cff", light: "#ffffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrPreview(url);
      })
      .catch(() => setQrPreview(""));
    return () => {
      cancelled = true;
    };
  }, [include.qr, bookingUrl]);

  const details = useMemo(
    () => ({
      name: include.name ? name.trim() : "",
      phone: include.phone ? phone.trim() : "",
      email: include.email ? email.trim() : "",
      website: include.website ? website.trim() : "",
      logoUrl: include.logo ? (logo?.url ?? "") : "",
      bookingUrl: include.qr ? bookingUrl : "",
    }),
    [include, name, phone, email, website, logo, bookingUrl],
  );

  const anything = Boolean(
    details.name ||
      details.phone ||
      details.email ||
      details.website ||
      details.logoUrl ||
      details.bookingUrl,
  );


  const download = async (personalised: boolean) => {
    if (!personalised) {
      window.open(flyerPdf.url, "_blank", "noreferrer");
      return;
    }
    setBusy(true);
    try {
      const blob = await buildPersonalisedFlyer(details);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resonabed-flyer-${(details.name || "clinic")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your personalised flyer has been downloaded.");
    } catch {
      toast.error("Sorry, the flyer could not be generated. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const toggle = (key: FieldKey) => (v: boolean | "indeterminate") =>
    setInclude((prev) => ({ ...prev, [key]: v === true }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Client flyer</CardTitle>
            <CardDescription>
              The DL leaflet that ships with every kit. Add your clinic details to the blank panel
              on the back, then download a print-ready PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="f-name"
                  checked={include.name}
                  onCheckedChange={toggle("name")}
                  className="mt-2.5"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="f-name-input">Clinic name</Label>
                  <Input
                    id="f-name-input"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!include.name}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="f-phone"
                  checked={include.phone}
                  onCheckedChange={toggle("phone")}
                  className="mt-2.5"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="f-phone-input">Phone</Label>
                  <Input
                    id="f-phone-input"
                    value={phone}
                    maxLength={40}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!include.phone}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="f-email"
                  checked={include.email}
                  onCheckedChange={toggle("email")}
                  className="mt-2.5"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="f-email-input">Email</Label>
                  <Input
                    id="f-email-input"
                    value={email}
                    maxLength={80}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!include.email}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="f-web"
                  checked={include.website}
                  onCheckedChange={toggle("website")}
                  className="mt-2.5"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="f-web-input">Website, booking page</Label>
                  <Input
                    id="f-web-input"
                    value={website}
                    maxLength={80}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!include.website}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="f-logo"
                  checked={include.logo}
                  onCheckedChange={toggle("logo")}
                  disabled={!logo?.url}
                />
                <Label htmlFor="f-logo" className="font-normal">
                  {logo?.url
                    ? "Include your clinic logo"
                    : "Include your clinic logo (upload one in Settings first)"}
                </Label>
              </div>
            </div>

            <div className="space-y-2 border-t pt-5">
              <Button
                type="button"
                className="w-full"
                disabled={busy || !anything}
                onClick={() => download(true)}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download personalised flyer
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => download(false)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Download blank flyer
              </Button>
              <p className="text-xs text-muted-foreground">
                Print at DL size, A4 landscape, double sided, flipped on the short edge.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border bg-card">
            <img
              src={flyerOutside.url}
              alt="Outside of the Resonabed client flyer, showing the panel reserved for clinic details"
              className="h-auto w-full"
              loading="lazy"
            />
            {/* Live preview of the stamped panel, positioned over the artwork. */}
            <div
              className="absolute flex items-end gap-[3%] overflow-hidden bg-[#f7f1fd] px-[0.6%] py-[0.4%]"
              style={{ left: "2.6%", right: "69.6%", bottom: "5.3%", top: "76.1%" }}
            >
              <div className="flex min-w-0 flex-1 flex-col justify-end">
                {details.logoUrl ? (
                  <img
                    src={details.logoUrl}
                    alt=""
                    className="mb-[4%] max-h-[34%] w-auto self-start object-contain"
                  />
                ) : null}
                {details.name ? (
                  <p className="truncate text-[clamp(7px,1.1vw,13px)] font-semibold leading-tight text-brand-indigo">
                    {details.name}
                  </p>
                ) : null}
                {[details.phone, details.email, details.website].filter(Boolean).map((line) => (
                  <p
                    key={line}
                    className="truncate text-[clamp(6px,0.85vw,10px)] leading-snug text-muted-foreground"
                  >
                    {line}
                  </p>
                ))}
              </div>
              {qrPreview ? (
                <div className="flex shrink-0 flex-col items-center bg-white p-[2%]">
                  <img src={qrPreview} alt="Booking QR code" className="h-auto w-[54px] max-w-full" />
                  <span className="text-[clamp(6px,0.8vw,9px)] font-semibold leading-none text-brand-indigo">
                    Book Now
                  </span>
                </div>
              ) : null}
            </div>

          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            <img
              src={flyerInside.url}
              alt="Inside of the Resonabed client flyer"
              className="h-auto w-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
