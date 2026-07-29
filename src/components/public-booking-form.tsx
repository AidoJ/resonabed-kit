import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestPublicBooking } from "@/lib/public-booking.functions";
import { halfHourSlots, slotLabel, DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { PublicService } from "@/lib/public-org.functions";

const SLOTS = halfHourSlots(7, 20);

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function PublicBookingForm({
  slug,
  services,
  timezone,
  clinicName,
}: {
  slug: string;
  services: PublicService[];
  timezone: string;
  clinicName: string;
}) {
  const submit = useServerFn(requestPublicBooking);
  const tz = timezone || DEFAULT_TIMEZONE;

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <h3 className="text-lg font-semibold">Request sent</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {clinicName} will be in touch to confirm. Your request is not booked until the
            clinic confirms it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!serviceId || !date || !time || !firstName || !lastName || !email) {
      setError("Please complete all required fields.");
      return;
    }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          slug,
          service_id: serviceId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          preferred_date: date,
          preferred_time: time,
          note,
          // Captcha seam: token stays null until Turnstile is enabled.
          captcha_token: null,
        },
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pb-service">Session type *</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger id="pb-service">
                <SelectValue placeholder="Choose a session" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pb-first">First name *</Label>
              <Input
                id="pb-first"
                value={firstName}
                maxLength={80}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pb-last">Last name *</Label>
              <Input
                id="pb-last"
                value={lastName}
                maxLength={80}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pb-email">Email *</Label>
              <Input
                id="pb-email"
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pb-phone">Phone</Label>
              <Input
                id="pb-phone"
                type="tel"
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pb-date">Preferred date *</Label>
              <Input
                id="pb-date"
                type="date"
                value={date}
                min={todayInTz(tz)}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pb-time">Preferred time *</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="pb-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {slotLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="-mt-1 text-xs text-muted-foreground">
            Times are in {tz.replace(/_/g, " ")}, the clinic&rsquo;s local time.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="pb-note">Anything you&rsquo;d like the clinic to know?</Label>
            <Textarea
              id="pb-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — preferred alternative times, accessibility needs, etc."
            />
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send booking request
          </Button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            This is a request, not a confirmed booking. {clinicName} will contact you to
            confirm a time. Your details are shared only with this clinic.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
