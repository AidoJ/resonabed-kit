import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  Users,
  Wrench,
  Music,
  ClipboardList,
  Megaphone,
  Clock,
  Calendar,
  Sparkles,
  UserCog,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Globe,
  Palette,
  ScrollText,
  AlertTriangle,
  PenLine,
  Volume2,
  BadgeCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({ meta: [{ title: "Help guide, ResonaBed" }] }),
  component: HelpPage,
});

// ---------- Small building blocks ----------

function Step({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {num}
        </div>
        <div className="mt-1 w-px flex-1 bg-border last:hidden" />
      </div>
      <div className="min-w-0 pb-1">
        <h4 className="font-medium leading-8">{title}</h4>
        <div className="mt-1 space-y-1.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>{children}</div>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  icon: typeof Settings;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      </div>
      {intro && <p className="mb-5 mt-3 text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function GoTo({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to as "/help"}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
    >
      Open {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

const TOC: { id: string; label: string; adminOnly?: boolean }[] = [
  { id: "orientation", label: "Getting oriented" },
  { id: "settings", label: "1. Settings (start here)", adminOnly: true },
  { id: "team", label: "2. Team", adminOnly: true },
  { id: "services", label: "3. Services", adminOnly: true },
  { id: "audio", label: "4. Audio library", adminOnly: true },
  { id: "reports", label: "5. Reports", adminOnly: true },
  { id: "marketing", label: "6. Marketing", adminOnly: true },
  { id: "availability", label: "7. Availability" },
  { id: "clients", label: "8. Clients" },
  { id: "bookings", label: "9. Bookings" },
  { id: "sessions", label: "10. Running a session" },
  { id: "public-page", label: "11. Your public page" },
  { id: "profile", label: "12. My profile" },
];

function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <BookOpen className="h-6 w-6 text-primary" />
          Help guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A guided tour of Resonabed for clinic staff. Follow it in order the first
          time, work from <strong>Settings</strong> through the{" "}
          <strong>Administration</strong> items, then set up the day-to-day{" "}
          <strong>Clinic</strong> items. Sections marked{" "}
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
            Admin
          </span>{" "}
          are only visible to org admins.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="rounded-2xl border bg-card p-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Contents
        </p>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {TOC.map((t) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t.label}
                {t.adminOnly && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                    Admin
                  </span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {/* 0. Orientation */}
        <Section
          id="orientation"
          icon={BookOpen}
          eyebrow="Start"
          title="Getting oriented"
          intro="Two minutes of context before you touch anything."
        >
          <ul className="space-y-2">
            <Bullet>
              The sidebar is your map. <strong>Clinic</strong> is the daily work
              (sessions, clients, bookings, availability).{" "}
              <strong>Administration</strong> is setup and back-office (team,
              services, audio, reports, marketing, settings).
            </Bullet>
            <Bullet>
              Your role decides what you see. <strong>Org admins</strong> see
              everything; <strong>practitioners</strong> see the Clinic group and,
              depending on your clinic's permission toggles, some client and booking
              management.
            </Bullet>
            <Bullet>
              Nothing goes live publicly until your admin completes the Settings
              checklist and publishes the public page, so it is safe to explore.
            </Bullet>
          </ul>
        </Section>

        {/* 1. Settings */}
        <Section
          id="settings"
          icon={Settings}
          eyebrow="Administration · Step 1"
          title="Settings, set up your clinic first"
          intro="Everything else builds on this. Until Settings is complete and the legal acknowledgement is signed, the app blocks new sessions, so do this before anything else."
        >
          <ol>
            <Step num={1} title="Identity">
              <p>
                Check your clinic name and public-facing details. If your clinic is
                home-based, make sure <strong>clinic type</strong> is set to{" "}
                <em>Home</em>, your street address will never appear publicly and is
                only released to a client after their booking is confirmed.
              </p>
            </Step>
            <Step num={2} title="Branding">
              <p>
                Upload your logo and pick your brand colours (primary, sidebar,
                accent). These theme the staff app, your public booking page, and the
                personalised flyers in the Marketing tab.
              </p>
            </Step>
            <Step num={3} title="Contact & address">
              <p>
                Add your public phone/email and address. Home-based clinics choose
                whether phone and email are shown publicly or withheld.
              </p>
            </Step>
            <Step num={4} title="Policies & legal acknowledgement">
              <p>
                Review the session policies and sign the legal acknowledgement. This
                is the go-live gate: sessions cannot be started until it is signed,
                and every signature is recorded in the policy audit log.
              </p>
            </Step>
          </ol>
          <div className="mt-5 space-y-3">
            <Tip>
              You can come back and refine branding any time, the public page and
              flyers update automatically.
            </Tip>
            <GoTo to="/admin/settings" label="Settings" />
          </div>
        </Section>

        {/* 2. Team */}
        <Section
          id="team"
          icon={Users}
          eyebrow="Administration · Step 2"
          title="Team, invite your practitioners"
          intro="Add everyone who will run sessions or manage bookings."
        >
          <ol>
            <Step num={1} title="Invite a team member">
              <p>
                Create their account with name, email and role
                (<strong>org admin</strong> or <strong>practitioner</strong>). They
                receive an invite email and must set a password on first sign-in.
              </p>
            </Step>
            <Step num={2} title="Add a bio and headshot">
              <p>
                These appear in the <em>Our Practitioners</em> section of your public
                page, clients pick a practitioner when they request a booking, so a
                friendly photo and a sentence or two convert better.
              </p>
            </Step>
            <Step num={3} title="Manage over time">
              <p>
                Reset passwords, edit details, or deactivate members who leave.
                Deactivated members keep their history but cannot sign in.
              </p>
            </Step>
          </ol>
          <div className="mt-5 space-y-3">
            <Warn>
              Only make someone an org admin if they truly need it, admins can change
              pricing, policies and team access.
            </Warn>
            <GoTo to="/admin/team" label="Team" />
          </div>
        </Section>

        {/* 3. Services */}
        <Section
          id="services"
          icon={Wrench}
          eyebrow="Administration · Step 3"
          title="Services, what clients can book"
          intro="Your service menu: standard Resonabed sessions plus your own extras."
        >
          <ul className="space-y-2">
            <Bullet>
              <strong>Standard sessions</strong> come from the Resonabed catalogue.
              Their wording and pictures are platform-owned, you set the{" "}
              <strong>price, visibility and turnaround buffer</strong> only.
            </Bullet>
            <Bullet>
              <strong>Your own services</strong> are fully yours: name, description,
              image, duration, buffer and price.
            </Bullet>
            <Bullet>
              <strong>Buffer minutes</strong> add turnaround time after each booking
              so the room is ready for the next client.
            </Bullet>
            <Bullet>
              Drag to reorder, the order here is the order clients see on your
              public page.
            </Bullet>
            <Bullet>
              Toggle <strong>active</strong> off to hide a service without deleting
              it. RRP is shown as a pricing guide from Resonabed.
            </Bullet>
          </ul>
          <div className="mt-5">
            <GoTo to="/admin/services" label="Services" />
          </div>
        </Section>

        {/* 4. Audio library */}
        <Section
          id="audio"
          icon={Music}
          eyebrow="Administration · Step 4"
          title="Audio library, your session music"
          intro="The music played during sessions, grouped by Solfeggio frequency."
        >
          <ul className="space-y-2">
            <Bullet>
              Each of the 9 Solfeggio frequencies has <strong>global tracks</strong>{" "}
              supplied by Resonabed. These are read-only and require an active music
              licence.
            </Bullet>
            <Bullet>
              Upload your own <strong>MP3/WAV</strong> to any frequency, your upload
              takes precedence over the global track for your clinic.
            </Bullet>
            <Bullet>
              Toggle tracks active/inactive to control what practitioners can pick in
              the session wizard.
            </Bullet>
          </ul>
          <div className="mt-5 space-y-3">
            <Tip>
              Keep uploads gentle and low-frequency friendly, they are felt through
              the therapy table as much as heard.
            </Tip>
            <GoTo to="/audio" label="Audio library" />
          </div>
        </Section>

        {/* 5. Reports */}
        <Section
          id="reports"
          icon={ClipboardList}
          eyebrow="Administration · Step 5"
          title="Reports, how the clinic is doing"
          intro="Session counts, revenue recorded, popular services and frequencies, and practitioner activity. Check weekly to spot trends."
        >
          <div className="space-y-3">
            <Tip>
              Payment records come from marking sessions as paid, encourage the team
              to record payment at session completion so these reports stay accurate.
            </Tip>
            <GoTo to="/admin/reports" label="Reports" />
          </div>
        </Section>

        {/* 6. Marketing */}
        <Section
          id="marketing"
          icon={Megaphone}
          eyebrow="Administration · Step 6"
          title="Marketing, flyers and brochures"
          intro="Download a personalised Resonabed flyer and tri-fold brochure with your clinic's details, branding and a QR code that links straight to your public booking page."
        >
          <ul className="space-y-2">
            <Bullet>
              The PDFs are generated in your browser with your logo, colours and
              contact details, print-ready.
            </Bullet>
            <Bullet>
              The QR code points at your public page, so update Settings before
              printing a big batch.
            </Bullet>
          </ul>
          <div className="mt-5">
            <GoTo to="/admin/marketing" label="Marketing" />
          </div>
        </Section>

        {/* 7. Availability */}
        <Section
          id="availability"
          icon={Clock}
          eyebrow="Clinic · Step 7"
          title="Availability, when can clients book"
          intro="Weekly working hours per practitioner. Your public page only offers times inside these windows."
        >
          <ol>
            <Step num={1} title="Add each practitioner's hours">
              <p>
                For every day they work, add a start and end time. Org admins can
                edit anyone; practitioners see and manage their own.
              </p>
            </Step>
            <Step num={2} title="Keep it current">
              <p>
                Toggle a block off for holidays instead of deleting it. Changes apply
                to new booking requests immediately.
              </p>
            </Step>
          </ol>
          <div className="mt-5 space-y-3">
            <Warn>
              No availability = no bookable times. Clients will see your page but
              cannot pick a slot.
            </Warn>
            <GoTo to="/availability" label="Availability" />
          </div>
        </Section>

        {/* 8. Clients */}
        <Section
          id="clients"
          icon={UserCog}
          eyebrow="Clinic · Step 8"
          title="Clients, your client records"
          intro="Every client who books or has a session gets a record with their contact details and full session history."
        >
          <ul className="space-y-2">
            <Bullet>
              Add clients manually, or they are created automatically from public
              booking requests.
            </Bullet>
            <Bullet>
              Open a client to see past sessions, their wellbeing check-in trends,
              and their safety screening history.
            </Bullet>
            <Bullet>
              Whether practitioners can add/edit all clients depends on your clinic's
              permission toggles, ask your org admin if a button is missing.
            </Bullet>
          </ul>
          <div className="mt-5">
            <GoTo to="/admin/clients" label="Clients" />
          </div>
        </Section>

        {/* 9. Bookings */}
        <Section
          id="bookings"
          icon={Calendar}
          eyebrow="Clinic · Step 9"
          title="Bookings, requests and the calendar"
          intro="The calendar shows everything booked. Requests from your public page land here for review."
        >
          <ol>
            <Step num={1} title="Review public requests">
              <p>
                New requests arrive as <strong>pending</strong>. Review the client,
                service, preferred practitioner and requested time, then confirm or
                propose alternate times, the client picks from a link emailed to
                them.
              </p>
            </Step>
            <Step num={2} title="Book directly">
              <p>
                Use <strong>New booking</strong> for phone/walk-in clients: pick the
                client (or add them inline), service, practitioner and a slot, only
                times inside working hours are offered.
              </p>
            </Step>
            <Step num={3} title="Reschedule when life happens">
              <p>
                Open a booking to reschedule it. The client is kept informed by
                email, including the address release for home-based clinics.
              </p>
            </Step>
          </ol>
          <div className="mt-5">
            <GoTo to="/bookings" label="Bookings" />
          </div>
        </Section>

        {/* 10. Sessions */}
        <Section
          id="sessions"
          icon={Sparkles}
          eyebrow="Clinic · Step 10"
          title="Running a session"
          intro="The core of the app. The wizard walks you through safety, then the player runs the session hands-free."
        >
          <ol>
            <Step num={1} title="Start from a booking, or fresh">
              <p>
                <strong>Start session</strong> on a confirmed booking pre-fills the
                client and service. You can also start a standalone session from the
                Sessions page.
              </p>
            </Step>
            <Step num={2} title="Safety screening, every time">
              <p>
                The wizard checks contraindications. Flagged items block the session
                unless a doctor's clearance letter is recorded; pregnancy is
                non-clearable. This protects the client and the clinic.
              </p>
            </Step>
            <Step num={3} title="Wellbeing check-in">
              <p>
                Six sliders (arousal, mood, relaxation, pain, sleep, physical ease)
                capture how the client feels. Trends build up on their record over
                time, great for showing progress.
              </p>
            </Step>
            <Step num={4} title="Frequency & music">
              <p>
                The app suggests frequencies matched to the client's symptoms, pick
                one, then choose a track from the audio library.
              </p>
            </Step>
            <Step num={5} title="Signature & acknowledgement">
              <p>
                The client signs on the tablet to acknowledge the session policies
                before you begin.
              </p>
            </Step>
            <Step num={6} title="The player">
              <p>
                Dark, tablet-friendly screen with a big countdown. The screen stays
                awake automatically. Music fades out and a chime plays as time
                expires. At completion, record payment (your admin may require this
                before the session can be closed).
              </p>
            </Step>
          </ol>
          <div className="mt-5 space-y-3">
            <Tip>
              Sessions run best in landscape on a tablet placed where the client can
              sign and you can glance at the timer.
            </Tip>
            <GoTo to="/sessions" label="Sessions" />
          </div>
        </Section>

        {/* 11. Public page */}
        <Section
          id="public-page"
          icon={Globe}
          eyebrow="Clinic · Step 11"
          title="Your public page"
          intro="Your clinic's landing page with services, practitioners, science sections and the booking-request form."
        >
          <ul className="space-y-2">
            <Bullet>
              Publish it from Settings once your services, team bios and availability
              are in place. Use <strong>Go to webpage</strong> in the sidebar to see
              exactly what clients see.
            </Bullet>
            <Bullet>
              Share the link (or the QR code from Marketing) anywhere: socials,
              email footers, the front desk.
            </Bullet>
            <Bullet>
              Home-based clinics: your address stays hidden until a booking is
              confirmed, only your suburb/region shows.
            </Bullet>
          </ul>
        </Section>

        {/* 12. Profile */}
        <Section
          id="profile"
          icon={BadgeCheck}
          eyebrow="You · Step 12"
          title="My profile"
          intro="Your personal details and password."
        >
          <ul className="space-y-2">
            <Bullet>
              Update your display name, this is what clients see on the public page.
            </Bullet>
            <Bullet>
              Change your password any time, the strength checklist shows what a
              good password needs.
            </Bullet>
          </ul>
          <div className="mt-5">
            <GoTo to="/profile" label="My profile" />
          </div>
        </Section>

        {/* First-day checklist */}
        <section className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">First-day checklist</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Settings, text: "Settings complete & acknowledgement signed" },
              { icon: Users, text: "Team invited, with bios and headshots" },
              { icon: Wrench, text: "Services priced and ordered" },
              { icon: Music, text: "Audio reviewed, uploads added if wanted" },
              { icon: Clock, text: "Availability set for every practitioner" },
              { icon: Palette, text: "Branding checked on the public page" },
              { icon: Globe, text: "Public page published & link shared" },
              { icon: ScrollText, text: "Flyer downloaded from Marketing" },
              { icon: Calendar, text: "Test booking made and confirmed" },
              { icon: Volume2, text: "Test session run end-to-end on the table" },
              { icon: PenLine, text: "Client signature flow tried on the tablet" },
              { icon: BadgeCheck, text: "Password changed in My profile" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <item.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium">{i + 1}.</span>
                <span className="text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
          <p
            className={cn(
              "mt-4 text-sm text-muted-foreground",
            )}
          >
            Do these in order and the clinic is live. Everything after that is
            repeat steps 7–10: availability, bookings, sessions.
          </p>
        </section>
      </div>
    </div>
  );
}
