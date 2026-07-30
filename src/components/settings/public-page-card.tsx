import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Globe, Loader2 } from "lucide-react";
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
  public_contact_email: string | null;
  public_contact_phone: string | null;
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [suburb, setSuburb] = useState("");
  const [tz, setTz] = useState("Australia/Brisbane");
  const [published, setPublished] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSlug(org.slug ?? "");
    setBlurb(org.public_blurb ?? "");
    setEmail(org.public_contact_email ?? "");
    setPhone(org.public_contact_phone ?? "");
    setSuburb(org.public_suburb ?? "");
    setTz(org.timezone ?? "Australia/Brisbane");
    setPublished(!!org.published);
    setBookingEnabled(!!org.public_booking_enabled);
  }, [org]);

  const dirty =
    slug !== (org.slug ?? "") ||
    blurb !== (org.public_blurb ?? "") ||
    email !== (org.public_contact_email ?? "") ||
    phone !== (org.public_contact_phone ?? "") ||
    suburb !== (org.public_suburb ?? "") ||
    tz !== (org.timezone ?? "Australia/Brisbane") ||
    published !== !!org.published ||
    bookingEnabled !== !!org.public_booking_enabled;

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
          public_contact_email: email || null,
          public_contact_phone: phone || null,
          public_suburb: suburb || null,
          timezone: tz,
          published,
          public_booking_enabled: published ? bookingEnabled : false,
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pub-email">Public contact email</Label>
            <Input
              id="pub-email"
              type="email"
              value={email}
              placeholder="hello@yourclinic.com.au"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-phone">Public contact phone</Label>
            <Input
              id="pub-phone"
              value={phone}
              placeholder="07 1234 5678"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
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
            Shown on your public page so visitors know where you are. Leave blank to hide it.
          </p>
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

        {org.published && publicUrl ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="truncate text-sm">{publicUrl}</span>
            <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={copyUrl}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              Copy
            </Button>
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
