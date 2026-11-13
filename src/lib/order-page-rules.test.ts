import { describe, expect, it } from "vitest";
import {
  clinicSetupStatus,
  isDepositOverdue,
  releaseStageFor,
} from "./order-page-rules";

const now = new Date("2026-12-31T00:00:00Z");
const base = {
  stage: "deposit",
  status: "sent",
  totalCents: 10000,
  paidCents: 0,
  orderState: "draft",
};

describe("deposit overdue", () => {
  it("is not overdue at 29 days", () => {
    expect(isDepositOverdue({ ...base, issuedAt: "2026-12-02T00:00:00Z" }, now)).toBe(false);
  });
  it("is overdue at 30 days with no deposit", () => {
    expect(isDepositOverdue({ ...base, issuedAt: "2026-12-01T00:00:00Z" }, now)).toBe(true);
  });
  it("is never overdue once the deposit is recorded or the invoice is void", () => {
    const old = { ...base, issuedAt: "2026-10-01T00:00:00Z" };
    expect(isDepositOverdue({ ...old, paidCents: 10000 }, now)).toBe(false);
    expect(isDepositOverdue({ ...old, status: "void" }, now)).toBe(false);
    expect(isDepositOverdue({ ...old, orderState: "deposit_paid" }, now)).toBe(false);
  });
  it("only applies to deposit invoices", () => {
    expect(
      isDepositOverdue({ ...base, stage: "balance_eft", issuedAt: "2026-10-01T00:00:00Z" }, now),
    ).toBe(false);
  });
});

describe("order page release", () => {
  it("shows no access details at the deposit stage", () => {
    expect(releaseStageFor("draft", null)).toBe("none");
    expect(releaseStageFor("deposit_paid", null)).toBe("none");
  });
  it("shows access details once paid in full and released", () => {
    expect(releaseStageFor("fulfilled", "2026-12-01T00:00:00Z")).toBe("released");
  });
  it("hides access details on refunded or defaulted orders", () => {
    expect(releaseStageFor("refunded", "2026-12-01T00:00:00Z")).toBe("none");
    expect(releaseStageFor("defaulted", "2026-12-01T00:00:00Z")).toBe("none");
  });
  it("maps the clinic setup queue to the status shown", () => {
    expect(clinicSetupStatus("pending")).toBe("setting_up");
    expect(clinicSetupStatus("provisioned")).toBe("ready");
  });
});
