/**
 * The arrears read model. Deliberately answers the question the desk actually
 * asks — "who owes what today, and who is worth chasing" — rather than just
 * printing a status column.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { KitOrderRow } from "@/lib/orders.server";
import {
  ARREARS_TO_DEFAULT_DAYS,
  CLEAN_PAYER_GRACE_DAYS,
  RETRY_WINDOW_DAYS,
  daysSinceFirstFailure,
  defaultDueDay,
  outstandingCents,
  planAccessLevel,
  tierFor,
} from "@/lib/plan-arrears.server";
import type { ArrearsRow, ArrearsSummary } from "@/lib/arrears.functions";

const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_STATES = ["plan_active", "arrears", "defaulted", "fulfilled"] as const;

function bucketFor(order: KitOrderRow, outstanding: number): ArrearsRow["bucket"] {
  const behind = !!order.arrears_since || order.state === "arrears" || order.state === "defaulted";
  if (!behind) return "healthy";
  // Light tier is never chased hard: it lands in the human-decision bucket.
  if (tierFor(outstanding) === "light") return "soft";
  if (order.state === "defaulted" || (order.access_level ?? "full") !== "full") return "action";
  const days = daysSinceFirstFailure(order);
  if (days >= RETRY_WINDOW_DAYS + ARREARS_TO_DEFAULT_DAYS - 5) return "action";
  return "chasing";
}

export async function fetchPlanArrears(): Promise<{
  rows: ArrearsRow[];
  summary: ArrearsSummary;
}> {
  const { data } = await supabaseAdmin
    .from("kit_orders")
    .select("*")
    .in("state", PLAN_STATES as unknown as string[])
    .not("plan_months", "is", null)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as KitOrderRow[];
  const now = new Date();
  const rows: ArrearsRow[] = [];

  for (const order of orders) {
    // Skip plans that finished cleanly and were never in arrears.
    const months = order.plan_months ?? 0;
    if (!months) continue;
    const outstanding = outstandingCents(order);
    const monthly = order.plan_monthly_cents ?? 0;
    const behind =
      !!order.arrears_since || order.state === "arrears" || order.state === "defaulted";
    const missed = behind
      ? Math.max(1, (order.payments_due ?? order.payments_made) - order.payments_made)
      : 0;
    const days = order.first_failure_at ? daysSinceFirstFailure(order, now) : null;
    const dueDay = defaultDueDay(order);

    rows.push({
      id: order.id,
      orderNumber: order.order_number,
      packageLabel: order.package_label,
      buyerType: order.buyer_type === "business" ? "business" : "personal",
      buyerName: order.contact_name ?? order.business_name ?? null,
      buyerEmail: order.contact_email ?? null,
      state: order.state,
      bucket: bucketFor(order, outstanding),
      tier: tierFor(outstanding),
      paymentsMade: order.payments_made,
      paymentsDue: months,
      monthlyCents: monthly,
      collectedCents: order.collected_cents,
      contractCents: order.contract_cents,
      outstandingCents: outstanding,
      owedTodayCents: missed * monthly,
      arrearsSince: order.arrears_since,
      daysInArrears:
        order.arrears_since !== null
          ? Math.floor((now.getTime() - new Date(order.arrears_since).getTime()) / DAY_MS)
          : null,
      defaultDueInDays:
        days !== null && order.state !== "defaulted" ? Math.max(0, dueDay - days) : null,
      defaultedAt: order.defaulted_at ?? null,
      windDownAt: order.wind_down_at ?? null,
      accessLevel: planAccessLevel(order, now),
      dunningStage: order.dunning_stage ?? 0,
      lastDunningAt: order.last_dunning_at ?? null,
      dunningPausedUntil: order.dunning_paused_until ?? null,
      writeOffCents: order.write_off_cents ?? null,
    });
  }

  // Outstanding descending inside priority buckets: biggest money first.
  const order = { action: 0, chasing: 1, soft: 2, healthy: 3 } as const;
  rows.sort(
    (a, b) => order[a.bucket] - order[b.bucket] || b.outstandingCents - a.outstandingCents,
  );

  const behindRows = rows.filter((r) => r.bucket !== "healthy");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const { count: recovered } = await supabaseAdmin
    .from("kit_order_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "plan_restored")
    .gte("created_at", monthStart);

  const { data: writeOffs } = await supabaseAdmin
    .from("kit_order_events")
    .select("detail")
    .eq("event_type", "plan_written_off")
    .gte("created_at", yearStart);

  const writtenOff = (writeOffs ?? []).reduce((sum, e) => {
    const cents = (e.detail as { outstanding_cents?: number } | null)?.outstanding_cents ?? 0;
    return sum + cents;
  }, 0);

  return {
    rows,
    summary: {
      totalOutstandingCents: rows.reduce((s, r) => s + r.outstandingCents, 0),
      atRiskCents: behindRows.reduce((s, r) => s + r.outstandingCents, 0),
      recoveredThisMonth: recovered ?? 0,
      writtenOffThisYearCents: writtenOff,
      counts: {
        action: rows.filter((r) => r.bucket === "action").length,
        chasing: rows.filter((r) => r.bucket === "chasing").length,
        soft: rows.filter((r) => r.bucket === "soft").length,
        healthy: rows.filter((r) => r.bucket === "healthy").length,
      },
    },
  };
}

export { CLEAN_PAYER_GRACE_DAYS };
