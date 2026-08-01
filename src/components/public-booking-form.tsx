import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requestPublicBooking } from "@/lib/public-booking.functions";
import { phoneValidationError, PHONE_HELP_TEXT } from "@/lib/phone";
import { halfHourSlots, slotLabel, DEFAULT_TIMEZONE, minutesOfDayInTz } from "@/lib/timezone";
import type { PublicService } from "@/lib/public-org.functions";
import {
  type AvailabilityWindow,
  describePattern,
  isWorkingDate,
  slotsForDate,
} from "@/lib/availability-pattern";

const OPEN_SLOTS = halfHourSlots(7, 20);

function money(v: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}

/** Split start times into friendly parts of the day so long days don't become a wall of pills. */
function groupSlots(slots: string[]) {
  const groups: { label: string; items: string[] }[] = [
    { label: "Morning", items: [] },
    { label: "Afternoon", items: [] },
    { label: "Evening", items: [] },
  ];
  for (const s of slots) {
    const h = Number(s.slice(0, 2));
    if (h < 12) groups[0].items.push(s);
    else if (h < 17) groups[1].items.push(s);
    else groups[2].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}

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
  availability = [],
}: {
  slug: string;
  services: PublicService[];
  timezone: string;
  clinicName: string;
  /**
   * The clinic's merged working pattern. Days/hours only, never a live slot
   * map, never who is working, never what is already booked.
   */
  availability?: AvailabilityWindow[];
}) {
  const submit = useServerFn(requestPublicBooking);
  const tz = timezone || DEFAULT_TIMEZONE;

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [period, setPeriod] = useState<string | null>(null);

  const phoneProblem = phone ? phoneValidationError(phone) : null;

  const duration = services.find((s) => s.id === serviceId)?.duration_minutes ?? 60;
  const hasPattern = availability.length > 0;
  const patternLines = hasPattern ? describePattern(availability) : [];
  const today = todayInTz(tz);
  const nowMinutes = minutesOfDayInTz(new Date(), tz);

  const dateIsWorking = !date || !hasPattern || isWorkingDate(availability, date);
  const slots = (() => {
    if (!date) return [] as string[];
    const base = hasPattern ? slotsForDate(availability, date, duration) : OPEN_SLOTS;
    // An hour's lead time on same-day requests, matching the server rule.
    return date === today ? base.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m >= nowMinutes + 60;
    }) : base;
  })();

  const groups = groupSlots(slots);
  const activePeriod =
    (period && groups.some((g) => g.label === period) ? period : null) ??
    groups.find((g) => g.items.includes(time))?.label ??
    groups[0]?.label ??
    null;
  const activeItems = groups.find((g) => g.label === activePeriod)?.items ?? [];

  // Keep the chosen time valid whenever the date or session type changes.
  const slotKey = slots.join(",");
  useEffect(() => {
    if (slots.length > 0 && !slots.includes(time)) setTime(slots[0]);
    setPeriod(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);




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
    if (hasPattern && !isWorkingDate(availability, date)) {
      setError("Please choose a date the clinic works.");
      return;
    }
    if (slots.length === 0 || !slots.includes(time)) {
      setError("Please choose an available start time.");
      return;
    }
    const badPhone = phoneValidationError(phone);
    if (badPhone) {
      setPhoneTouched(true);
      setError(badPhone);
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
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Choose your session</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => {
                const selected = s.id === serviceId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/60",
                      selected && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{s.name}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {s.duration_minutes} min
                        {s.price !== null && s.price !== undefined
                          ? ` · ${money(Number(s.price))}`
                          : ""}
                      </span>
                    </span>
                    {selected ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

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
            <div className="grid content-start gap-2">
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
            <div className="grid content-start gap-2">
              <Label htmlFor="pb-phone">Phone *</Label>
              <Input
                id="pb-phone"
                type="tel"
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
                required
                aria-invalid={phoneTouched && phoneProblem !== null}
                onBlur={() => setPhoneTouched(true)}
              />
              {phoneTouched && phoneProblem ? (
                <p className="text-xs text-destructive">{phoneProblem}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{PHONE_HELP_TEXT}</p>
              )}
              <p className="text-xs text-muted-foreground">
                We may call you before confirming your first session.
              </p>
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
          </div>

          {slots.length > 0 ? (
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">Preferred time *</legend>
              {groups.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      aria-pressed={g.label === activePeriod}
                      onClick={() => setPeriod(g.label)}
                      className={cn(
                        "rounded-full border px-5 py-2 text-sm font-medium transition-colors hover:border-primary/60",
                        g.label === activePeriod
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {activeItems.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === time}
                    onClick={() => setTime(s)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-primary/60",
                      s === time && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {slotLabel(s)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}


          {!dateIsWorking ? (
            <p className="-mt-1 text-xs text-destructive">
              The clinic doesn&rsquo;t work on that day. Please choose one of their working
              days below.
            </p>
          ) : date && slots.length === 0 ? (
            <p className="-mt-1 text-xs text-destructive">
              No start times left on that date for this session length. Please choose another
              date.
            </p>
          ) : null}

          <p className="-mt-1 text-xs text-muted-foreground">
            Times are in {tz.replace(/_/g, " ")}, the clinic&rsquo;s local time.
            {hasPattern ? " You can request any time within the clinic's working hours." : ""}
          </p>

          {hasPattern ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium">Working days and hours</p>
              <ul className="mt-1 space-y-0.5">
                {patternLines.map((line) => (
                  <li key={line} className="text-xs text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="pb-note">Anything you&rsquo;d like the clinic to know?</Label>
            <Textarea
              id="pb-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional, preferred alternative times, accessibility needs, etc."
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
