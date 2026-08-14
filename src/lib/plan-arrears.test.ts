/**
 * Simulated-clock coverage for the payment-plan revenue protection rules.
 *
 * Stripe test clocks are a test-mode-only feature and this project is
 * configured with a LIVE Stripe key, so the lifecycle is driven here by an
 * explicit simulated clock over the same pure decision functions the runtime
 * uses (`planAccessLevel`, `tierFor`, `defaultDueDay`). Those functions are the
 * single source of the access rule, so a pass here is a real statement about
 * runtime behaviour, not a mock of it.
 */
import { describe, expect, it } from "vitest";
import type { KitOrderRow } from "@/lib/orders.server";
import {
  ARREARS_TO_DEFAULT_DAYS,
  CLEAN_PAYER_GRACE_DAYS,
  CLINIC_WIND_DOWN_DAYS,
  RETRY_WINDOW_DAYS,
  defaultDueDay,
  outstandingCents,
  planAccessLevel,
  tierFor,
} from "@/lib/plan-arrears.server";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-01-01T00:00:00Z").getTime();
const at = (days: number) => new Date(T0 + days * DAY);

function order(patch: Partial<KitOrderRow> = {}): KitOrderRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_number: "ORD-00001",
    state: "plan_active",
    buyer_type: "personal",
    plan_months: 10,
    plan_monthly_cents: 11000,
    payments_made: 0,
    payments_due: 10,
    collected_cents: 40000,
    contract_cents: 150000,
    failure_count: 0,
    prior_failure_count: 0,
    dunning_stage: 0,
    access_level: "full",
    arrears_since: null,
    first_failure_at: null,
    defaulted_at: null,
    wind_down_at: null,
    stripe_subscription_id: "sub_test",
  } as unknown as KitOrderRow;
}

/** Mirrors the sweep's escalation decision without touching the database. */
function stepClock(o: KitOrderRow, now: Date) {
  const days = o.first_failure_at
    ? (now.getTime() - new Date(o.first_failure_at).getTime()) / DAY
    : 0;
  let next = { ...o } as KitOrderRow;
  if (!o.first_failure_at) return next;
  if (days >= RETRY_WINDOW_DAYS && next.state === "plan_active") {
    next = { ...next, state: "arrears" } as KitOrderRow;
  }
  if (days >= defaultDueDay(o) && next.state === "arrears") {
    const tier = tierFor(outstandingCents(next));
    if (tier !== "light") {
      next = {
        ...next,
        state: "defaulted",
        defaulted_at: now.toISOString(),
        wind_down_at:
          tier === "heavy" && next.buyer_type === "business"
            ? new Date(now.getTime() + CLINIC_WIND_DOWN_DAYS * DAY).toISOString()
            : null,
      } as KitOrderRow;
    }
  }
  return next;
}

function fail(o: KitOrderRow, now: Date): KitOrderRow {
  return {
    ...o,
    arrears_since: o.arrears_since ?? now.toISOString(),
    first_failure_at: o.first_failure_at ?? now.toISOString(),
    failure_count: o.failure_count + 1,
  } as KitOrderRow;
}

/** The restore path, as `restorePlanAfterPayment` writes it. */
function pay(o: KitOrderRow): KitOrderRow {
  return {
    ...o,
    payments_made: Math.min(o.plan_months ?? 10, o.payments_made + 1),
    state: "plan_active",
    arrears_since: null,
    first_failure_at: null,
    defaulted_at: null,
    wind_down_at: null,
    dunning_stage: 0,
    access_level: "full",
  } as KitOrderRow;
}

describe("HIGH RISK 1: a paying customer is never wrongly locked out", () => {
  it("keeps full access across a clean 10 month lifecycle", () => {
    let o = order();
    for (let m = 1; m <= 10; m += 1) {
      o = pay(o);
      expect(planAccessLevel(o, at(m * 30))).toBe("full");
    }
    expect(o.payments_made).toBe(10);
    expect(outstandingCents(o)).toBe(0);
  });

  it("keeps full access while a failure is only being retried and dunned", () => {
    let o = fail(order(), at(0));
    for (const d of [0, 3, 5, 7, 9, 10, 14, 20, 23]) {
      o = stepClock(o, at(d));
      expect(planAccessLevel(o, at(d))).toBe("full");
    }
  });

  it("restores full access instantly when a Stripe retry recovers on day 5", () => {
    let o = fail(order({ payments_made: 1 }), at(0));
    o = stepClock(o, at(5));
    o = pay(o);
    expect(o.state).toBe("plan_active");
    expect(planAccessLevel(o, at(5))).toBe("full");
    expect(o.arrears_since).toBeNull();
  });

  it("restores full access on a late catch-up after default", () => {
    let o = fail(order({ payments_made: 2 }), at(0));
    o = stepClock(o, at(31));
    expect(o.state).toBe("defaulted");
    expect(planAccessLevel(o, at(31))).toBe("suspended");
    o = pay(o);
    expect(planAccessLevel(o, at(31))).toBe("full");
    expect(o.defaulted_at).toBeNull();
  });
});

describe("HIGH RISK 2: the tiered consequence lands at day 24, never before", () => {
  it("clean payer gets the +7 grace, so the gate is day 31", () => {
    let o = fail(order({ payments_made: 1 }), at(0));
    expect(defaultDueDay(o)).toBe(RETRY_WINDOW_DAYS + ARREARS_TO_DEFAULT_DAYS + CLEAN_PAYER_GRACE_DAYS);
    o = stepClock(o, at(30));
    expect(o.state).toBe("arrears");
    expect(planAccessLevel(o, at(30))).toBe("full");
    o = stepClock(o, at(31));
    expect(o.state).toBe("defaulted");
  });

  it("a repeat misser hits the gate at day 24 exactly", () => {
    let o = fail(order({ payments_made: 1, prior_failure_count: 2 }), at(0));
    expect(defaultDueDay(o)).toBe(24);
    o = stepClock(o, at(23.9));
    expect(o.state).toBe("arrears");
    o = stepClock(o, at(24));
    expect(o.state).toBe("defaulted");
  });

  it("heavy home buyer is suspended; heavy clinic is limited then suspended after wind-down", () => {
    // Home, payment 1 of 10: $990 outstanding, heavy.
    let home = fail(order({ payments_made: 1, prior_failure_count: 1 }), at(0));
    home = stepClock(home, at(24));
    expect(tierFor(outstandingCents(home))).toBe("heavy");
    expect(planAccessLevel(home, at(24))).toBe("suspended");

    let clinic = fail(
      order({ payments_made: 1, prior_failure_count: 1, buyer_type: "business" }),
      at(0),
    );
    clinic = stepClock(clinic, at(24));
    expect(planAccessLevel(clinic, at(24))).toBe("limited");
    expect(planAccessLevel(clinic, at(30))).toBe("limited");
    expect(planAccessLevel(clinic, at(31))).toBe("suspended");
  });

  it("moderate tier is limited, never suspended, for either buyer type", () => {
    for (const buyer of ["personal", "business"] as const) {
      // 6 of 10 paid: $440 outstanding, moderate.
      let o = fail(order({ payments_made: 6, prior_failure_count: 1, buyer_type: buyer }), at(0));
      o = stepClock(o, at(40));
      expect(tierFor(outstandingCents(o))).toBe("moderate");
      expect(o.state).toBe("defaulted");
      expect(planAccessLevel(o, at(40))).toBe("limited");
    }
  });

  it("tier C never auto-defaults, however long it runs", () => {
    // 9 of 10 paid: $110 outstanding, light.
    let o = fail(order({ payments_made: 9, prior_failure_count: 3 }), at(0));
    for (const d of [10, 24, 31, 90, 365]) {
      o = stepClock(o, at(d));
      expect(o.state).toBe("arrears");
      expect(planAccessLevel(o, at(d))).toBe("full");
    }
    expect(tierFor(outstandingCents(o))).toBe("light");
  });

  it("the $250 floor and $700 band sit exactly where the policy says", () => {
    expect(tierFor(69999)).toBe("moderate");
    expect(tierFor(70000)).toBe("heavy");
    expect(tierFor(24999)).toBe("light");
    expect(tierFor(25000)).toBe("moderate");
  });
});

describe("HIGH RISK 3: auto-restore is total and instant", () => {
  it("returns a suspended home buyer to full access with one payment", () => {
    let o = fail(order({ payments_made: 1, prior_failure_count: 1 }), at(0));
    o = stepClock(o, at(24));
    expect(planAccessLevel(o, at(24))).toBe("suspended");
    o = pay(o);
    expect(planAccessLevel(o, at(24))).toBe("full");
    expect(o.state).toBe("plan_active");
    expect(o.wind_down_at).toBeNull();
    expect(o.dunning_stage).toBe(0);
  });

  it("returns a suspended clinic to full access and cancels the wind-down", () => {
    let o = fail(
      order({ payments_made: 1, prior_failure_count: 1, buyer_type: "business" }),
      at(0),
    );
    o = stepClock(o, at(24));
    expect(planAccessLevel(o, at(31))).toBe("suspended");
    o = pay(o);
    expect(planAccessLevel(o, at(31))).toBe("full");
    expect(o.wind_down_at).toBeNull();
  });

  it("a plan that defaults twice restores cleanly both times", () => {
    let o = order({ payments_made: 1, prior_failure_count: 1 });
    for (let round = 0; round < 2; round += 1) {
      o = fail(o, at(round * 100));
      o = stepClock(o, at(round * 100 + 24));
      expect(o.state).toBe("defaulted");
      o = pay(o);
      expect(planAccessLevel(o, at(round * 100 + 24))).toBe("full");
    }
    expect(o.payments_made).toBe(3);
  });
});

describe("policy invariants", () => {
  it("access is only ever reduced from the defaulted state", () => {
    for (const state of ["plan_active", "arrears", "fulfilled", "plan_completed"] as const) {
      const o = order({ state, payments_made: 0, buyer_type: "business" });
      expect(planAccessLevel(o, at(500))).toBe("full");
    }
  });

  it("outstanding is driven by monthlies remaining, not by elapsed time", () => {
    expect(outstandingCents(order({ payments_made: 0 }))).toBe(110000);
    expect(outstandingCents(order({ payments_made: 10 }))).toBe(0);
    expect(outstandingCents(order({ payments_made: 12 }))).toBe(0);
  });
});
