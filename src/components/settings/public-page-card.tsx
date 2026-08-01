import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Home,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { updateOrgSettings } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
  "Pacific/Auckland",
];

export type PublicPageOrg = {
  slug: string | null;
  published: boolean;
  public_blurb: string | null;
  public_strapline: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  public_show_email: boolean;
  public_show_phone: boolean;
  public_suburb: string | null;
  public_booking_enabled: boolean;
  timezone: string | null;
  is_configured: boolean;
  clinic_type: "retail" | "home";
  clinic_type_confirmed: boolean;
  retail_show_address: boolean;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postcode: string | null;
  address_country: string | null;
};


function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function PublicPageCard({ org }: { org: PublicPageOrg }) {
  const saveOrg = useServerFn(updateOrgSettings);
  const qc = useQueryClient();

  const [slug, setSlug] = useState("");
  const [blurb, setBlurb] = useState("");
  const [strapline, setStrapline] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [suburb, setSuburb] = useState("");
  const [tz, setTz] = useState("Australia/Brisbane");
  const [published, setPublished] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [clinicType, setClinicType] = useState<"retail" | "home" | "">("");
  const [showAddress, setShowAddress] = useState(true);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSlug(org.slug ?? "");
    setBlurb(org.public_blurb ?? "");
    setStrapline(org.public_strapline ?? "");
    setEmail(org.public_contact_email ?? "");
    setPhone(org.public_contact_phone ?? "");
    setShowEmail(!!org.public_show_email);
    setShowPhone(!!org.public_show_phone);
    setSuburb(org.public_suburb ?? "");
    setTz(org.timezone ?? "Australia/Brisbane");
    setPublished(!!org.published);
    setBookingEnabled(!!org.public_booking_enabled);
    setClinicType(org.clinic_type_confirmed ? org.clinic_type : "");
    setShowAddress(org.retail_show_address !== false);
    setLine1(org.address_line1 ?? "");
    setLine2(org.address_line2 ?? "");
    setCity(org.address_city ?? "");
    setState(org.address_state ?? "");
    setPostcode(org.address_postcode ?? "");
  }, [org]);

  const dirty =
    slug !== (org.slug ?? "") ||
    blurb !== (org.public_blurb ?? "") ||
    strapline !== (org.public_strapline ?? "") ||
    email !== (org.public_contact_email ?? "") ||
    phone !== (org.public_contact_phone ?? "") ||
    showEmail !== !!org.public_show_email ||
    showPhone !== !!org.public_show_phone ||
    suburb !== (org.public_suburb ?? "") ||
    tz !== (org.timezone ?? "Australia/Brisbane") ||
    published !== !!org.published ||
    bookingEnabled !== !!org.public_booking_enabled ||
    clinicType !== (org.clinic_type_confirmed ? org.clinic_type : "") ||
    showAddress !== (org.retail_show_address !== false) ||
    line1 !== (org.address_line1 ?? "") ||
    line2 !== (org.address_line2 ?? "") ||
    city !== (org.address_city ?? "") ||
    state !== (org.address_state ?? "") ||
    postcode !== (org.address_postcode ?? "");

  const slugValid = slug === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const slugLongEnough = slug === "" || slug.length >= 3;
  const slugChangedWhilePublished = !!org.slug && org.published && slug !== org.slug;
  const publicUrl = useMemo(
    () => (org.slug ? `https://resonabed.com/o/${org.slug}` : null),
    [org.slug],
  );

  const blockers: string[] = [];
  if (published) {
    if (!slug) blockers.push("a public URL name");
    if (!org.is_configured) blockers.push("completed clinic setup (signed acknowledgement)");
    if (!clinicType) blockers.push("a clinic type (retail/commercial or home-based)");
    if (!line1.trim()) blockers.push("your clinic address (kept private for home-based clinics)");
  }

  const onSave = async () => {
    if (!slugValid || !slugLongEnough) {
      toast.error("Public URL name must be at least 3 characters, lowercase letters, numbers and hyphens.");
      return;
    }
    if (blockers.length > 0) {
      toast.error(`You need ${blockers.join(" and ")} before publishing.`);
      return;
    }
    setSaving(true);
    try {
      await saveOrg({
        data: {
          slug: slug ? slug : null,
          public_blurb: blurb || null,
          public_strapline: strapline.trim() || null,
          public_contact_email: email || null,
          public_contact_phone: phone || null,
          public_show_email: showEmail,
          public_show_phone: showPhone,
          public_suburb: suburb || null,
          timezone: tz,
          published,
          public_booking_enabled: published ? bookingEnabled : false,
          ...(clinicType ? { clinic_type: clinicType } : {}),
          retail_show_address: clinicType === "home" ? false : showAddress,
          address_line1: line1 || null,
          address_line2: line2 || null,
          address_city: city || null,
          address_state: state || null,
          address_postcode: postcode || null,
        } as never,
      });

      toast.success("Public page settings saved");
      qc.invalidateQueries({ queryKey: ["org-settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Public link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Public page
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A simple public page for your clinic — your name, logo, services and contact details.
          It stays hidden until you publish it.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pub-slug">Public URL name</Label>
            <div className="flex items-center gap-1">
              <span className="shrink-0 text-sm text-muted-foreground">/o/</span>
              <Input
                id="pub-slug"
                value={slug}
                placeholder="my-clinic"
                onChange={(e) => setSlug(slugify(e.target.value))}
              />
            </div>
            {!slugValid || !slugLongEnough ? (
              <p className="text-xs text-destructive">
                Use at least 3 characters: lowercase letters, numbers and hyphens.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and hyphens. Must be unique across Resonabed.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-tz">Timezone</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger id="pub-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Appointment times are shown in this timezone.
            </p>
          </div>
        </div>

        {slugChangedWhilePublished ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Changing your public URL will break existing links</p>
              <p className="text-amber-800/80 dark:text-amber-100/80">
                Anyone who has bookmarked or shared <strong>/o/{org.slug}</strong> will get a
                &ldquo;page not available&rdquo; message. Only change this if you&rsquo;re sure.
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="pub-strapline">Strapline (beside your logo)</Label>
          <Input
            id="pub-strapline"
            value={strapline}
            maxLength={50}
            placeholder="Gentle sound, deep rest"
            onChange={(e) => setStrapline(e.target.value.slice(0, 50))}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              A short line about your clinic, shown next to your logo at the top of your public
              page. Leave blank to show nothing.
            </p>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {strapline.length}/50
            </span>
          </div>
          <p className="text-xs font-medium leading-relaxed text-destructive">
            Your words, your responsibility. Don&rsquo;t claim to treat, heal, cure or diagnose any
            condition, and avoid guaranteed outcomes or medical language — this applies to
            anything you say about your clinic, not just vibroacoustic therapy. Straplines that
            make health claims may breach advertising and therapeutic-goods rules.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-blurb">About your clinic</Label>
          <Textarea
            id="pub-blurb"
            rows={5}
            maxLength={4000}
            value={blurb}
            placeholder="A short welcome for visitors — who you are, what a session is like, where you're located."
            onChange={(e) => setBlurb(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Keep it about relaxation and general wellbeing. Avoid medical or treatment claims —
            a standard wellbeing notice is shown on every public page.
          </p>
        </div>

        {/* ------------------------------------------- direct contact details */}
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Your direct contact details</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {clinicType === "home"
                ? "For a home-based studio, we recommend keeping your direct phone and email private and letting clients reach you through the booking request. You’ll get their details and can contact them yourself. You can choose to publish your contact details if you prefer."
                : "A shopfront usually wants to be easy to reach, so publishing your phone and email here is fine. Turn either off if you’d rather visitors used the booking request."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pub-email">Contact email</Label>
              <Input
                id="pub-email"
                type="email"
                value={email}
                placeholder="hello@yourclinic.com.au"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pub-phone">Contact phone</Label>
              <Input
                id="pub-phone"
                value={phone}
                placeholder="07 1234 5678"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Publish my email</p>
              <p className="text-xs text-muted-foreground">
                Shows your email on your public page, and includes it in booking emails.
              </p>
            </div>
            <Switch checked={showEmail} onCheckedChange={setShowEmail} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Publish my phone number</p>
              <p className="text-xs text-muted-foreground">
                Shows your number on your public page, and includes it in booking emails.
              </p>
            </div>
            <Switch checked={showPhone} onCheckedChange={setShowPhone} />
          </div>

          {!showEmail && !showPhone ? (
            <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Your details stay private. Visitors start with a booking request, and you get
                their name, phone and email so you can call them back.
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-suburb">Suburb / location</Label>
          <Input
            id="pub-suburb"
            value={suburb}
            placeholder="Noosaville, QLD"
            onChange={(e) => setSuburb(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The general area only — shown publicly for every clinic. Never your street address.
          </p>
        </div>

        {/* ------------------------------------------------ clinic type + address */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2" htmlFor="pub-clinic-type">
              <Home className="h-4 w-4 text-primary" />
              What kind of clinic is this?
            </Label>
            <Select
              value={clinicType}
              onValueChange={(v) => {
                const next = v as "retail" | "home";
                setClinicType(next);
                // Safe default follows the clinic type: a lone home operator
                // starts private, a shopfront starts reachable.
                if (!org.clinic_type_confirmed) {
                  setShowEmail(next === "retail");
                  setShowPhone(next === "retail");
                }
              }}
            >
              <SelectTrigger id="pub-clinic-type">
                <SelectValue placeholder="Choose retail/commercial or home-based" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail / commercial address</SelectItem>
                <SelectItem value="home">Home-based business</SelectItem>
              </SelectContent>
            </Select>
            {clinicType === "home" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your address stays private. It&rsquo;s never shown on your public page — clients
                receive it in their confirmation email once you confirm their booking.
              </p>
            ) : clinicType === "retail" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your street address may be shown on your public page. Clients also receive it in
                their confirmation email once you confirm a booking.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                This choice decides whether your street address can ever appear publicly, so
                please choose it yourself — there&rsquo;s no default.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr1">Street address</Label>
              <Input
                id="addr1"
                value={line1}
                placeholder="12 Quiet Street"
                onChange={(e) => setLine1(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr2">Unit / suite (optional)</Label>
              <Input id="addr2" value={line2} onChange={(e) => setLine2(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">Suburb / city</Label>
              <Input id="addr-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addr-state">State</Label>
                <Input id="addr-state" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addr-pc">Postcode</Label>
                <Input
                  id="addr-pc"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                />
              </div>
            </div>
          </div>

          {clinicType === "home" ? (
            <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Home-based clinics can&rsquo;t publish a street address. If you ever want your
                address shown publicly, change your clinic type to retail / commercial above.
              </span>
            </div>
          ) : clinicType === "retail" ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show address on public page</p>
                <p className="text-xs text-muted-foreground">
                  Turn off if you&rsquo;d rather visitors contacted you first.
                </p>
              </div>
              <Switch checked={showAddress} onCheckedChange={setShowAddress} />
            </div>
          ) : null}
        </div>



        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Published</p>
              <p className="text-xs text-muted-foreground">
                Makes your page visible to anyone with the link. Requires a public URL name and
                completed clinic setup.
              </p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Public booking requests</p>
              <p className="text-xs text-muted-foreground">
                Lets visitors send you a booking request. Requests always arrive as pending for you
                to confirm — nothing is booked automatically.
              </p>
            </div>
            <Switch
              checked={bookingEnabled}
              disabled={!published}
              onCheckedChange={setBookingEnabled}
            />
          </div>
        </div>

        {org.slug ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="min-w-0 flex-1 truncate text-sm">{publicUrl}</span>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={copyUrl} disabled={!org.published}>
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                Copy
              </Button>
              {org.published ? (
                <Button size="sm" asChild>
                  {/* Relative path so this opens the page on whichever site
                      you're signed in to, not just the live domain. */}
                  <a href={`/o/${org.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Go to webpage
                  </a>
                </Button>
              ) : (
                <Button size="sm" disabled>
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Go to webpage
                </Button>
              )}
            </div>
            {!org.published ? (
              <p className="w-full text-xs text-muted-foreground">
                Your page isn&rsquo;t published yet, so this link won&rsquo;t work for visitors.
              </p>
            ) : null}
          </div>
        ) : null}

        {blockers.length > 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            To publish you still need {blockers.join(" and ")}.
          </p>
        ) : null}

        <div className="pt-1">
          <Button disabled={!dirty || saving} onClick={onSave}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : dirty ? (
              "Save public page"
            ) : (
              "Saved"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
