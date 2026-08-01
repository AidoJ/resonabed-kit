import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { Sparkles, Calendar, ArrowRight, Music } from "lucide-react";

import { getCurrentUserContext } from "@/lib/user-context.functions";
import { listMyOrgSessions } from "@/lib/sessions.functions";
import { listBookings } from "@/lib/bookings.functions";
import { getMyOrgLicence } from "@/lib/licence.functions";
import { getAppSetting, MUSIC_RENEWAL_PRICE_KEY } from "@/lib/app-settings.functions";
import { getPlatformMetrics } from "@/lib/platform-metrics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import {
  addDaysToDate,
  dayStartUtc,
  DEFAULT_TIMEZONE,
  formatInTz,
  isoDateInTz,
  todayInTz,
} from "@/lib/timezone";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard, Resonabed" }] }),
  component: DashboardPage,
});

function statusStyles(status: string) {
  switch (status) {
    case "completed":
      return "bg-success/12 text-success";
    case "in_progress":
      return "bg-secondary text-brand-indigo";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function fmtTime(iso: string, tz: string) {
  return formatInTz(iso, tz);
}

/** "Today" means today in the ORG timezone, not on the operator's device. */
function isToday(iso: string, tz: string) {
  return isoDateInTz(iso, tz) === todayInTz(tz);
}

function DashboardPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const listSessions = useServerFn(listMyOrgSessions);
  const listBookingsFn = useServerFn(listBookings);
  const fetchLicence = useServerFn(getMyOrgLicence);
  const fetchSetting = useServerFn(getAppSetting);

  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  // Super_admin outside support mode: NEVER fetch org-scoped data. Their RLS
  // effectively bypasses org scoping (is_super_admin(auth.uid()) OR org_id =
  // current_org_id()), so listMyOrgSessions / listBookings / getMyOrgLicence
  // would return every org's rows. Gate on the resolved role.
  const isBareSuperAdmin =
    !!ctx && ctx.roles.includes("super_admin") && !ctx.activeSupportSession;
  const clinicalEnabled = !!ctx && !isBareSuperAdmin;

  const { data: licence } = useQuery({
    queryKey: ["my-org-licence"],
    queryFn: () => fetchLicence(),
    enabled: clinicalEnabled,
  });
  const { data: renewalPrice } = useQuery({
    queryKey: ["app-setting", MUSIC_RENEWAL_PRICE_KEY],
    queryFn: () => fetchSetting({ data: { key: MUSIC_RENEWAL_PRICE_KEY } }),
    enabled: clinicalEnabled,
  });
  const { data: sessions } = useQuery({
    queryKey: ["dash-sessions"],
    queryFn: () => listSessions(),
    enabled: clinicalEnabled,
  });
  const tz = ctx?.org?.timezone || DEFAULT_TIMEZONE;
  const bookingsRange = useMemo(() => {
    const today = todayInTz(tz);
    return { from: dayStartUtc(today, tz), to: dayStartUtc(addDaysToDate(today, 7), tz) };
  }, [tz]);
  const { data: bookings } = useQuery({
    queryKey: ["dash-bookings", bookingsRange.from.toISOString(), bookingsRange.to.toISOString()],
    queryFn: () =>
      listBookingsFn({
        data: {
          from: bookingsRange.from.toISOString(),
          to: bookingsRange.to.toISOString(),
        },
      }),
    enabled: clinicalEnabled,
  });

  const todayIso = todayInTz(tz);
  const todayStart = dayStartUtc(todayIso, tz);
  const twoDaysOut = dayStartUtc(addDaysToDate(todayIso, 2), tz);

  const todaysSessions = (sessions ?? []).filter((s) =>
    s.created_at ? isToday(s.created_at, tz) : false,
  );
  const recentSessions = (sessions ?? []).slice(0, 6);
  const unpaid = (sessions ?? []).filter(
    (s) => s.status === "completed" && s.payment_method === "none",
  );
  const upcomingBookings = (bookings ?? [])
    .filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= todayStart.getTime() && t < twoDaysOut.getTime();
    })
    .slice(0, 4);

  if (ctxLoading) {
    return <Skeleton className="h-40 w-full max-w-xl" />;
  }

  // Super_admin (platform operator) sees a platform overview, never clinic data.
  if (isBareSuperAdmin) {
    return <SuperAdminDashboard displayName={ctx?.displayName ?? null} />;
  }



  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <div className="shadow-soft flex flex-col gap-6 rounded-2xl bg-card p-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {ctx?.org?.name ?? "No organisation"}
          </p>
          <h1 className="mt-2 text-3xl font-light tracking-tight text-brand-indigo">
            Welcome{ctx?.displayName ? `, ${ctx.displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Ready when your client is. Start a session in one tap.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            asChild
            className="h-14 rounded-[10px] px-8 text-[15px] font-medium shadow-lift"
          >
            <Link to="/sessions/new">
              <Sparkles className="mr-2 h-5 w-5" />
              New session
            </Link>
          </Button>
        </div>
      </div>

      {licence &&
      licence.expires_at &&
      (!licence.is_ok ||
        new Date(licence.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000) ? (
        <div
          className={`shadow-soft flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            !licence.is_ok
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          }`}
        >
          <Music className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {!licence.is_ok ? (
              <>
                <strong>Music licence expired.</strong> The 9 global Solfeggio tracks are locked
                until renewal. Your own uploaded audio still plays.{" "}
                {renewalPrice ? <>Renew for {renewalPrice}, c</> : <>C</>}ontact ResonaBed to renew.
              </>
            ) : (
              <>
                <strong>Music licence expiring soon.</strong> Renew before{" "}
                {formatInTz(licence.expires_at, tz, { day: "numeric", month: "short", year: "numeric" })}
                {renewalPrice ? <> ({renewalPrice})</> : null} to keep uninterrupted access to the
                global track library.
              </>
            )}
          </div>
        </div>
      ) : null}

      {!ctx?.org && !ctx?.roles.includes("super_admin") ? (
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="text-base font-medium">Waiting on setup</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your account isn&rsquo;t linked to an organisation yet. A super admin needs to assign
            you before you can access clients and sessions.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today */}
        <section className="shadow-soft rounded-2xl bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium text-brand-indigo">Today&rsquo;s sessions</h2>
            <Link to="/sessions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {todaysSessions.length === 0 ? (
            <EmptyRow
              text="No sessions started today yet."
              cta={<Link to="/sessions/new" className="text-primary hover:underline">Start one</Link>}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {todaysSessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </ul>
          )}
        </section>

        {/* Unpaid */}
        <section className="shadow-soft rounded-2xl bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium text-brand-indigo">Unpaid</h2>
            <span className="rounded-full bg-warning/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-warning">
              {unpaid.length}
            </span>
          </div>
          {unpaid.length === 0 ? (
            <p className="text-sm text-muted-foreground">All completed sessions are recorded.</p>
          ) : (
            <ul className="space-y-3">
              {unpaid.slice(0, 5).map((s) => {
                const client = s.client as { first_name: string; last_name: string } | null;
                return (
                  <li key={s.id}>
                    <Link
                      to="/sessions/$id"
                      params={{ id: s.id }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/60"
                    >
                      <span className="truncate text-sm">
                        {client ? `${client.first_name} ${client.last_name}` : "—"}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent sessions */}
        <section className="shadow-soft rounded-2xl bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium text-brand-indigo">Recent sessions</h2>
            <Link to="/sessions" className="text-sm text-primary hover:underline">
              Session history
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <EmptyRow text="No sessions recorded yet." />
          ) : (
            <ul className="divide-y divide-border/60">
              {recentSessions.map((s) => (
                <SessionRow key={s.id} s={s} showDate />
              ))}
            </ul>
          )}
        </section>

        {/* Bookings, secondary */}
        <section className="shadow-soft rounded-2xl bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium text-brand-indigo">Bookings</h2>
            <Link to="/bookings" className="text-sm text-muted-foreground hover:text-primary">
              Diary
            </Link>
          </div>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing on the diary. Use Bookings if you keep a schedule in Resonabed.
            </p>
          ) : (
            <ul className="space-y-3">
              {upcomingBookings.map((b) => {
                const c = b.client as { first_name: string; last_name: string } | null;
                return (
                  <li key={b.id}>
                    <Link
                      to="/bookings/$id"
                      params={{ id: b.id }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60"
                    >
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {c ? `${c.first_name} ${c.last_name}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {fmtTime(b.starts_at, tz)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

interface SessionRowProps {
  s: {
    id: string;
    status: string;
    created_at: string | null;
    client: unknown;
    service: unknown;
    frequency: unknown;
    payment_method: string | null;
  };
  showDate?: boolean;
}

function SessionRow({ s, showDate }: SessionRowProps) {
  const tz = useOrgTimezone();
  const client = s.client as { first_name: string; last_name: string } | null;
  const service = s.service as { name: string } | null;
  const freq = s.frequency as { hz: number; color: string | null } | null;
  const unpaid = s.status === "completed" && s.payment_method === "none";
  return (
    <li>
      <Link
        to="/sessions/$id"
        params={{ id: s.id }}
        className="flex items-center gap-4 px-1 py-3 transition-colors hover:bg-muted/40"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: freq?.color ?? "var(--brand-tint)" }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px]">
            {client ? `${client.first_name} ${client.last_name}` : "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {service?.name ?? "—"}
            {freq ? ` · ${freq.hz} Hz` : ""}
            {showDate && s.created_at
              ? ` · ${formatInTz(s.created_at, tz, { month: "short", day: "numeric" })}`
              : ""}
          </p>
        </div>
        {unpaid && (
          <span className="rounded-full bg-warning/12 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-warning">
            Unpaid
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${statusStyles(s.status)}`}
        >
          {s.status.replace("_", " ")}
        </span>
      </Link>
    </li>
  );
}

function EmptyRow({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div
        aria-hidden="true"
        className="mb-3 h-10 w-10 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--brand-violet) 30%, transparent), transparent 70%)",
        }}
      />
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta ? <div className="mt-2 text-sm">{cta}</div> : null}
    </div>
  );
}

function SuperAdminDashboard({ displayName }: { displayName: string | null }) {
  const fetchMetrics = useServerFn(getPlatformMetrics);
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["platform-metrics-dashboard"],
    queryFn: () => fetchMetrics(),
  });
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="shadow-soft rounded-2xl bg-card p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          ResonaBed platform
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-brand-indigo">
          Welcome{displayName ? `, ${displayName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Aggregate platform metrics only. Individual clinic records are never shown here, use
          <strong> Access for support</strong> on the Organisations list to enter a specific
          clinic&rsquo;s data with a logged audit trail.
        </p>
      </div>

      {/* Aggregate metrics, counts and totals only, never individual rows. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Organisations"
          value={isLoading ? "—" : String(metrics?.orgs.total ?? 0)}
          hint={
            metrics
              ? `${metrics.orgs.active} active · ${metrics.orgs.suspended} suspended · ${metrics.orgs.unconfigured} unconfigured`
              : undefined
          }
        />
        <MetricCard
          label="New orgs (30d)"
          value={isLoading ? "—" : String(metrics?.totals.new_orgs_30d ?? 0)}
        />
        <MetricCard
          label="Sessions (30d)"
          value={isLoading ? "—" : String(metrics?.totals.sessions_30d ?? 0)}
          hint={metrics ? `${metrics.totals.sessions_total} lifetime` : undefined}
        />
        <MetricCard
          label="Bookings (30d)"
          value={isLoading ? "—" : String(metrics?.totals.bookings_30d ?? 0)}
          hint={metrics ? `${metrics.totals.bookings_total} lifetime` : undefined}
        />
        <MetricCard
          label="Licences, trial"
          value={isLoading ? "—" : String(metrics?.licences.trial ?? 0)}
        />
        <MetricCard
          label="Licences, active"
          value={isLoading ? "—" : String(metrics?.licences.active ?? 0)}
        />
        <MetricCard
          label="Licences, expiring < 30d"
          value={isLoading ? "—" : String(metrics?.licences.expiring_30d ?? 0)}
          hint={metrics ? `${metrics.licences.expired} expired` : undefined}
        />
        <MetricCard
          label="Revenue (lifetime)"
          value={isLoading ? "—" : money(metrics?.totals.revenue_total ?? 0)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlatformCard title="Organisations" href="/admin/organisations" description="Create, provision, licence and manage clinics." />
        <PlatformCard title="Global services" href="/admin/global-services" description="Default service catalogue seeded into new clinics." />
        <PlatformCard title="Global frequencies" href="/frequencies" description="Master frequency tuning used by every clinic." />
        <PlatformCard title="Global audio" href="/audio" description="Shipped tracks available to every clinic under licence." />
        <PlatformCard title="Platform metrics" href="/admin/metrics" description="Full breakdown by organisation." />
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="shadow-soft rounded-2xl bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-light tabular-nums text-brand-indigo">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PlatformCard({
  title,
  href,
  description,
}: {
  title: string;
  href: string;
  description: string;
}) {
  return (
    <Link
      to={href as "/admin/organisations"}
      className="shadow-soft group flex flex-col rounded-2xl bg-card p-6 transition hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-brand-indigo">{title}</h3>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

