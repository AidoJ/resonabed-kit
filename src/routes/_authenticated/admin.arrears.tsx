/**
 * The payment-plan arrears desk. Built as a working surface: what is owed
 * today, how far through the plan each customer is, what happens next and
 * when, and the actions to intervene, all without leaving the page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  RotateCcw,
  ShieldOff,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  closePlanAsSettled,
  getPlanOrderEvents,
  listPlanArrears,
  pausePlanDunning,
  recordPlanPaymentOffline,
  resendPlanDunning,
  restorePlanAccess,
  resumePlanDunning,
  sendPlanCardLink,
  type ArrearsRow,
} from "@/lib/arrears.functions";

export const Route = createFileRoute("/_authenticated/admin/arrears")({
  head: () => ({
    meta: [
      { title: "Payment plans and arrears, ResonaBed" },
      {
        name: "description",
        content:
          "Track payment plan health: who owes what today, dunning progress, and access consequences.",
      },
    ],
  }),
  component: ArrearsPage,
});

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const BUCKETS = [
  {
    key: "action",
    label: "Needs action",
    blurb: "Real money at risk. Default is close, or already applied.",
    icon: AlertTriangle,
  },
  {
    key: "chasing",
    label: "Being chased",
    blurb: "Dunning is running. No consequence applied yet.",
    icon: BellRing,
  },
  {
    key: "soft",
    label: "Soft arrears",
    blurb: "Under $250 left. Never auto-defaults, your call.",
    icon: Sparkles,
  },
  { key: "healthy", label: "Healthy plans", blurb: "Paying on schedule.", icon: CheckCircle2 },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

function ArrearsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listPlanArrears);
  const [bucket, setBucket] = useState<BucketKey>("action");
  const [detail, setDetail] = useState<ArrearsRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan-arrears"],
    queryFn: () => load(),
  });

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => r.bucket === bucket),
    [data, bucket],
  );
  const summary = data?.summary;
  const refresh = () => qc.invalidateQueries({ queryKey: ["plan-arrears"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment plans</h1>
        <p className="text-muted-foreground">
          Every live 10 month plan, sorted by how much is actually at stake.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Owed across all plans"
          value={summary ? money(summary.totalOutstandingCents) : "—"}
          note="Remaining contract value"
        />
        <Stat
          label="At risk right now"
          value={summary ? money(summary.atRiskCents) : "—"}
          note="Outstanding on plans behind"
          tone="warn"
        />
        <Stat
          label="Recovered this month"
          value={summary ? String(summary.recoveredThisMonth) : "—"}
          note="Plans that self-restored"
          tone="good"
        />
        <Stat
          label="Written off this year"
          value={summary ? money(summary.writtenOffThisYearCents) : "—"}
          note="Deliberate small-balance closures"
        />
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as BucketKey)}>
        <TabsList className="flex-wrap">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.key} value={b.key} className="gap-2">
              <b.icon className="h-4 w-4" />
              {b.label}
              <Badge variant="secondary">{summary?.counts[b.key] ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        {BUCKETS.find((b) => b.key === bucket)?.blurb}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nothing in this bucket.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <PlanCard key={row.id} row={row} onOpen={() => setDetail(row)} />
          ))}
        </div>
      )}

      <PlanDetailDialog
        row={detail}
        onClose={() => setDetail(null)}
        onChanged={() => {
          refresh();
          setDetail(null);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "warn" | "good";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            tone === "warn"
              ? "text-2xl font-semibold text-destructive"
              : tone === "good"
                ? "text-2xl font-semibold text-primary"
                : "text-2xl font-semibold"
          }
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

const TIER_COPY: Record<ArrearsRow["tier"], string> = {
  heavy: "Heavy, over $700 outstanding",
  moderate: "Moderate, $250 to $699 outstanding",
  light: "Light, under $250 outstanding",
};

function accessBadge(row: ArrearsRow) {
  if (row.accessLevel === "suspended")
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldOff className="h-3 w-3" /> Access paused
      </Badge>
    );
  if (row.accessLevel === "limited")
    return (
      <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
        <ShieldOff className="h-3 w-3" /> Limited
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1">
      <CheckCircle2 className="h-3 w-3" /> Full access
    </Badge>
  );
}

function PlanCard({ row, onOpen }: { row: ArrearsRow; onOpen: () => void }) {
  const pct = row.paymentsDue ? (row.paymentsMade / row.paymentsDue) * 100 : 0;
  return (
    <Card className="cursor-pointer transition hover:border-primary/50" onClick={onOpen}>
      <CardContent className="grid gap-4 py-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.buyerName ?? row.buyerEmail ?? "Unnamed buyer"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {row.orderNumber} · {row.packageLabel} ·{" "}
            {row.buyerType === "business" ? "Clinic" : "Home"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {accessBadge(row)}
            {row.dunningPausedUntil ? (
              <Badge variant="outline" className="gap-1">
                <BellOff className="h-3 w-3" /> Dunning paused
              </Badge>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Payment {row.paymentsMade} of {row.paymentsDue}
          </p>
          <Progress value={pct} className="mt-2 h-2" />
          <p className="mt-1 text-xs text-muted-foreground">{TIER_COPY[row.tier]}</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-destructive">
            {row.owedTodayCents > 0 ? money(row.owedTodayCents) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            owed today · {money(row.outstandingCents)} left on contract
          </p>
        </div>

        <div className="text-right text-sm">
          {row.defaultedAt ? (
            <span className="text-destructive">Defaulted</span>
          ) : row.defaultDueInDays !== null ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {row.defaultDueInDays === 0
                ? "Gate today"
                : `${row.defaultDueInDays} days to gate`}
            </span>
          ) : (
            <span className="text-muted-foreground">On track</span>
          )}
          {row.daysInArrears !== null ? (
            <p className="text-xs text-muted-foreground">{row.daysInArrears} days in arrears</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanDetailDialog({
  row,
  onClose,
  onChanged,
}: {
  row: ArrearsRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const resend = useServerFn(resendPlanDunning);
  const cardLink = useServerFn(sendPlanCardLink);
  const pause = useServerFn(pausePlanDunning);
  const resume = useServerFn(resumePlanDunning);
  const restore = useServerFn(restorePlanAccess);
  const offline = useServerFn(recordPlanPaymentOffline);
  const settle = useServerFn(closePlanAsSettled);
  const events = useServerFn(getPlanOrderEvents);

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  const history = useQuery({
    queryKey: ["plan-arrears-events", row?.id],
    queryFn: () => events({ data: { orderId: row!.id } }),
    enabled: !!row,
  });

  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("Done");
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "That did not work"),
  });

  if (!row) return null;
  const busy = run.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row.buyerName ?? row.buyerEmail} · {row.orderNumber}
          </DialogTitle>
          <DialogDescription>
            {row.packageLabel} · {row.buyerType === "business" ? "Clinic" : "Home"} buyer ·{" "}
            {TIER_COPY[row.tier]}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label="Owed today" value={money(row.owedTodayCents)} />
          <Figure label="Remaining contract" value={money(row.outstandingCents)} />
          <Figure label="Collected so far" value={money(row.collectedCents)} />
        </div>

        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">What happens next</p>
          <p className="mt-1 text-muted-foreground">
            {row.defaultedAt
              ? `Defaulted. Access is ${row.accessLevel}. A payment restores everything instantly.`
              : row.tier === "light"
                ? "Under the $250 floor, so this will never auto-default. Chase gently or close it as settled."
                : row.defaultDueInDays !== null
                  ? `Dunning stage ${row.dunningStage}. The proportionate gate applies in ${row.defaultDueInDays} days if nothing is paid.`
                  : "Paying to schedule. Nothing to do."}
          </p>
          {row.windDownAt ? (
            <p className="mt-1 text-muted-foreground">
              Clinic wind-down ends {new Date(row.windDownAt).toLocaleDateString("en-AU")}. Bookings
              already confirmed still run, and client records are never withheld.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run.mutate(() => resend({ data: { orderId: row.id, stage: row.dunningStage } }))}
          >
            <Mail className="mr-2 h-4 w-4" /> Resend dunning email
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run.mutate(() => cardLink({ data: { orderId: row.id } }))}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Send card update link
          </Button>
          {row.dunningPausedUntil ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run.mutate(() => resume({ data: { orderId: row.id } }))}
            >
              <BellRing className="mr-2 h-4 w-4" /> Resume dunning
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run.mutate(() => pause({ data: { orderId: row.id, days: 14 } }))}
            >
              <BellOff className="mr-2 h-4 w-4" /> Pause chasing 14 days
            </Button>
          )}
          {row.accessLevel !== "full" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run.mutate(() => restore({ data: { orderId: row.id, note: "manual restore" } }))
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Restore access now
            </Button>
          ) : null}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Record a payment taken outside Stripe</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
            <div>
              <Label className="text-xs">Amount ($)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="110" />
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank transfer 14 Mar"
              />
            </div>
            <Button
              className="self-end"
              disabled={busy || !amount || !reference}
              onClick={() =>
                run.mutate(() =>
                  offline({
                    data: {
                      orderId: row.id,
                      amountCents: Math.round(Number(amount) * 100),
                      reference,
                    },
                  }),
                )
              }
            >
              Record
            </Button>
          </div>
        </div>

        {row.tier === "light" ? (
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">Close as settled</p>
            <p className="text-xs text-muted-foreground">
              Writes off {money(row.outstandingCents)} and ends the plan cleanly. Access stays full.
            </p>
            <Textarea
              className="mt-3"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why you are closing this"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => run.mutate(() => settle({ data: { orderId: row.id, reason } }))}
            >
              Close as settled
            </Button>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium">History</p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3 text-xs">
            {(history.data ?? []).map((e) => (
              <p key={e.id} className="text-muted-foreground">
                {new Date(e.created_at).toLocaleString("en-AU")} · {e.event_type}
                {e.to_state ? ` → ${e.to_state}` : ""}
              </p>
            ))}
            {history.data && history.data.length === 0 ? (
              <p className="text-muted-foreground">No events yet.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
