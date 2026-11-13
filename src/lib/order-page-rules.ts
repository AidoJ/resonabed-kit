/**
 * Pure rules for what a buyer's order page and the admin Invoices page show
 * once money has (or hasn't) arrived. No I/O, so each rule is tested alone.
 */

/** A bank-transfer deposit still unpaid this many days after the invoice is "Deposit overdue". */
export const DEPOSIT_OVERDUE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DepositInvoiceForOverdue = {
  stage: string | null;
  status: string;
  totalCents: number;
  paidCents: number;
  issuedAt: string;
  /** State of the linked website order, or null when there is none. */
  orderState: string | null;
};

/** Whole days since the invoice was raised (never negative). */
export function daysWaiting(issuedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(issuedAt).getTime()) / DAY_MS));
}

/**
 * True for a deposit invoice on a bank-transfer order that is still waiting on
 * its deposit 30 or more days after it was raised. Flag only: nothing is deleted.
 */
export function isDepositOverdue(inv: DepositInvoiceForOverdue, now: Date): boolean {
  if (inv.stage !== "deposit") return false;
  if (inv.orderState !== "draft") return false;
  if (inv.status === "paid" || inv.status === "void") return false;
  if (inv.paidCents >= inv.totalCents) return false;
  return daysWaiting(inv.issuedAt, now) >= DEPOSIT_OVERDUE_DAYS;
}

/** Order states in which a released order's access details stay on its page. */
const RELEASE_VISIBLE_STATES = new Set([
  "balance_paid",
  "plan_active",
  "fulfilled",
  "plan_completed",
  "arrears",
]);

export type ReleaseStage = "none" | "processing" | "released";

/**
 * What the order page shows after payment. Access details (Home code, clinic
 * setup status) appear only once the order has been released, which happens
 * only when the balance is paid; never at the deposit stage.
 */
export function releaseStageFor(state: string, fulfilledAt: string | null): ReleaseStage {
  if (!RELEASE_VISIBLE_STATES.has(state)) return "none";
  return fulfilledAt ? "released" : "processing";
}

export type ClinicSetupStatus = "setting_up" | "ready" | "unknown";

export function clinicSetupStatus(onboardingStatus: string | null | undefined): ClinicSetupStatus {
  if (onboardingStatus === "pending") return "setting_up";
  if (onboardingStatus === "provisioned") return "ready";
  return "unknown";
}
