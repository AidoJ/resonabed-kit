import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getKitPricing,
  setKitPackagePricing,
  setOrderDeposit,
} from "@/lib/pricing.functions";
import {
  ORDER_DEPOSIT_CENTS,
  PACKAGES,
  gstOf,
  money,
  type KitPriceRow,
  type PackageKey,
} from "@/lib/packages";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Kit pricing, Admin, ResonaBed" },
      {
        name: "description",
        content:
          "Edit the ResonaBed package prices, payment plan figures and the order deposit. Changes apply to new orders only.",
      },
    ],
  }),
  component: KitPricingAdmin,
});

/** Display dollars, keep cents in state. */
const dollarsOf = (cents: number) => (cents / 100).toString();
const centsOf = (raw: string) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
};

type Draft = {
  list: string;
  planDepositBalance: string;
  planMonthly: string;
  planMonths: string;
};

function KitPricingAdmin() {
  const fetchPricing = useServerFn(getKitPricing);
  const savePackage = useServerFn(setKitPackagePricing);
  const saveDeposit = useServerFn(setOrderDeposit);
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery({
    queryKey: ["kit-pricing"],
    queryFn: () => fetchPricing(),
  });

  const [drafts, setDrafts] = useState<Record<PackageKey, Draft> | null>(null);
  const [deposit, setDeposit] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!pricing) return;
    setDrafts(
      Object.fromEntries(
        Object.values(pricing.packages).map((p) => [
          p.key,
          {
            list: dollarsOf(p.listCents),
            planDepositBalance: dollarsOf(p.plan.depositBalanceCents),
            planMonthly: dollarsOf(p.plan.monthlyCents),
            planMonths: String(p.plan.months),
          },
        ]),
      ) as Record<PackageKey, Draft>,
    );
    setDeposit(dollarsOf(pricing.depositCents));
  }, [pricing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kit-pricing"] });

  const handleSavePackage = async (key: PackageKey) => {
    const d = drafts?.[key];
    if (!d) return;
    const listCents = centsOf(d.list);
    const planDepositBalanceCents = centsOf(d.planDepositBalance);
    const planMonthlyCents = centsOf(d.planMonthly);
    const planMonths = Number(d.planMonths);
    if (
      listCents === null ||
      listCents <= 0 ||
      planDepositBalanceCents === null ||
      planMonthlyCents === null ||
      planMonthlyCents <= 0 ||
      !Number.isInteger(planMonths) ||
      planMonths < 1 ||
      planMonths > 36
    ) {
      toast.error("Check the figures: prices must be positive and months between 1 and 36.");
      return;
    }
    setSaving(key);
    try {
      const row: KitPriceRow = {
        packageKey: key,
        listCents,
        planDepositBalanceCents,
        planMonthlyCents,
        planMonths,
      };
      await savePackage({ data: row });
      toast.success(`${PACKAGES[key].label} pricing saved. New orders use the new figures.`);
      await invalidate();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not save pricing.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveDeposit = async () => {
    const cents = centsOf(deposit);
    if (cents === null || cents <= 0) {
      toast.error("Enter a positive deposit amount.");
      return;
    }
    setSaving("deposit");
    try {
      await saveDeposit({ data: { depositCents: cents } });
      toast.success("Order deposit saved. It applies to new orders from now on.");
      await invalidate();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not save the deposit.");
    } finally {
      setSaving(null);
    }
  };

  if (isLoading || !drafts) {
    return <p className="text-sm text-muted-foreground">Loading pricing…</p>;
  }

  const depositCents = centsOf(deposit) ?? ORDER_DEPOSIT_CENTS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-brand-indigo">Kit pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These prices feed the website, checkout, invoices and payment plans. Changes apply to
          new orders only; existing orders and invoices keep the figures frozen at sale time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order deposit</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="deposit">Deposit charged today (AUD)</Label>
            <Input
              id="deposit"
              inputMode="decimal"
              className="w-32"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Every order starts with this deposit; the balance and shipping follow. Balance in
            full is the list price minus this deposit.
          </p>
          <Button
            onClick={() => void handleSaveDeposit()}
            disabled={saving !== null}
            className="ml-auto"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving === "deposit" ? "Saving…" : "Save deposit"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {(Object.keys(PACKAGES) as PackageKey[]).map((key) => {
          const def = PACKAGES[key];
          const d = drafts[key];
          const list = centsOf(d.list) ?? def.listCents;
          const balance = Math.max(0, list - depositCents);
          const gst = gstOf(list);
          const planDb = centsOf(d.planDepositBalance) ?? def.plan.depositBalanceCents;
          const planM = centsOf(d.planMonthly) ?? def.plan.monthlyCents;
          const months = Number(d.planMonths) || def.plan.months;
          const planTotal = depositCents + planDb + planM * months;
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">{def.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>List price incl. GST</Label>
                    <Input
                      inputMode="decimal"
                      value={d.list}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [key]: { ...d, list: e.target.value } })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan deposit balance</Label>
                    <Input
                      inputMode="decimal"
                      value={d.planDepositBalance}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [key]: { ...d, planDepositBalance: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monthly payment</Label>
                    <Input
                      inputMode="decimal"
                      value={d.planMonthly}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [key]: { ...d, planMonthly: e.target.value } })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monthly payments (count)</Label>
                    <Input
                      inputMode="numeric"
                      value={d.planMonths}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [key]: { ...d, planMonths: e.target.value } })
                      }
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-secondary/60 px-4 py-3 text-xs leading-relaxed text-foreground/80">
                  <p>
                    Website shows {money(list)} incl. GST ({money(list - gst)} + {money(gst)} GST).
                  </p>
                  <p className="mt-1">
                    Pay in full balance: {money(balance)}. Plan: {money(planDb)} + {months} ×{" "}
                    {money(planM)} = {money(planTotal)} total.
                  </p>
                </div>
                <Button
                  onClick={() => void handleSavePackage(key)}
                  disabled={saving !== null}
                  className="w-full"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving === key ? "Saving…" : `Save ${def.label}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
