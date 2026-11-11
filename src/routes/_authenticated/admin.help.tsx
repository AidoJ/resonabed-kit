import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Wrench,
  Waves,
  Music,
  ScrollText,
  ShieldPlus,
  BarChart3,
  Receipt,
  ClipboardCheck,
  FileText,
  Banknote,
  Tag,
  Truck,
  KeyRound,
  LifeBuoy,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/admin/help")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Platform admin guide, ResonaBed" }] }),
  component: AdminHelpPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{children}</span>
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

function AdminHelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <BookOpen className="h-6 w-6 text-primary" />
          Platform admin guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How to run the Resonabed platform: clinics, kit sales, the global
          catalogue and support access.
        </p>
      </div>

      <div className="space-y-6">
        <Section icon={ClipboardList} title="CRM, demo enquiries">
          <ul className="space-y-2">
            <Bullet>
              Every demo enquiry from the website lands here. Move each one through
              the pipeline stages as you work it.
            </Bullet>
            <Bullet>
              Assign an owner, set a follow-up date and keep notes on each enquiry.
              Filter by stage or owner to see your own queue.
            </Bullet>
            <Bullet>
              Deleting an enquiry also removes its notes. Only platform admins can
              delete.
            </Bullet>
          </ul>
        </Section>

        <Section icon={Building2} title="Organisations, the clinics">
          <ul className="space-y-2">
            <Bullet>
              Every clinic is an organisation. Open one to see its details, team,
              subscription status and public page.
            </Bullet>
            <Bullet>
              Create a clinic when a kit order is ready to go live, then invite its
              first org admin from the Team area inside support mode.
            </Bullet>
          </ul>
        </Section>

        <Section icon={Receipt} title="Kit sales, purchases and onboarding">
          <ul className="space-y-2">
            <Bullet>
              <strong>Purchases</strong> lists every kit order. When an order is
              paid in full (or its payment plan is active), the clinic's music
              licence activates automatically for 12 months.
            </Bullet>
            <Bullet>
              <strong>Clinic onboarding</strong> tracks each new clinic through the
              go-live checklist until their page is published.
            </Bullet>
            <Bullet>
              <strong>Invoices</strong> and <strong>Payments</strong> show the money
              side: balances, instalments and recorded payments.
            </Bullet>
            <Bullet>
              <strong>Promo codes</strong> support percentage or fixed-dollar
              discounts. <strong>Shipping rates</strong> set delivery pricing by
              region. <strong>Home access codes</strong> are the codes shipped with
              home beds that buyers use to activate the home app.
            </Bullet>
          </ul>
        </Section>

        <Section icon={Wrench} title="Global catalogue, services, frequencies and audio">
          <ul className="space-y-2">
            <Bullet>
              <strong>Global services</strong> are the standard Resonabed sessions
              every clinic can offer. Clinics set their own prices; the wording and
              images stay platform-owned.
            </Bullet>
            <Bullet>
              <strong>Global frequencies</strong> are the nine Solfeggio
              frequencies sessions are built around.
            </Bullet>
            <Bullet>
              <strong>Global audio</strong> holds the platform music library. Each
              frequency has up to four versions: Gentle, Deep Feel, and each of
              those with Ambient Sound (water or wind). Uploads here are available
              to every clinic with an active music licence.
            </Bullet>
          </ul>
          <Warn>
            Global audio changes affect every clinic at once. Double-check the
            frequency and version before replacing a track.
          </Warn>
        </Section>

        <Section icon={ScrollText} title="Policy templates">
          <ul className="space-y-2">
            <Bullet>
              The privacy, health &amp; safety and consent templates are the
              starting wording for <strong>new</strong> clinics. Editing a template
              does not change policies clinics have already saved.
            </Bullet>
          </ul>
        </Section>

        <Section icon={ShieldPlus} title="Platform admins">
          <ul className="space-y-2">
            <Bullet>
              Grant or revoke super admin access here. Super admins see every
              clinic and all platform data.
            </Bullet>
          </ul>
          <Warn>
            Only grant super admin to people who need full platform access, it
            cannot be limited per clinic.
          </Warn>
        </Section>

        <Section icon={BarChart3} title="Platform metrics">
          <ul className="space-y-2">
            <Bullet>
              Session volumes, active clinics and home users across the whole
              platform. Use it to spot growth and clinics that have gone quiet.
            </Bullet>
          </ul>
        </Section>

        <Section icon={LifeBuoy} title="Support mode, seeing a clinic as they see it">
          <ul className="space-y-2">
            <Bullet>
              From an organisation, enter <strong>support mode</strong> to view that
              clinic's app exactly as their staff do. A banner shows at the top the
              whole time.
            </Bullet>
            <Bullet>
              Use it to help a clinic with setup or to diagnose a problem. Exit
              support mode from the banner when finished.
            </Bullet>
          </ul>
          <Tip>
            Changes you make in support mode are real changes in that clinic's
            account, treat it like their own admin would.
          </Tip>
        </Section>
      </div>
    </div>
  );
}
