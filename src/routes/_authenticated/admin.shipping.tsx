import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  listShippingRatesAdmin,
  updateShippingRate,
  type ShippingRateRow,
} from "@/lib/shipping.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  head: () => ({ meta: [{ title: "Shipping rates, ResonaBed" }] }),
  component: ShippingRatesPage,
});

type Draft = { amountDollars: string; active: boolean };

function ShippingRatesPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  if (!ctxLoading && !ctx?.roles.includes("super_admin")) {
    throw redirect({ to: "/dashboard" });
  }

  const fetchRates = useServerFn(listShippingRatesAdmin);
  const { data: rates, isLoading } = useQuery({
    queryKey: ["shipping-rates-admin"],
    queryFn: () => fetchRates(),
    enabled: !!ctx?.roles.includes("super_admin"),
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    if (!rates) return;
    setDrafts((prev) => {
      const next: Record<string, Draft> = { ...prev };
      for (const r of rates) {
        if (!next[r.id]) {
          next[r.id] = {
            amountDollars: (r.amount_cents / 100).toFixed(2),
            active: r.active,
          };
        }
      }
      return next;
    });
  }, [rates]);

  const qc = useQueryClient();
  const updateFn = useServerFn(updateShippingRate);
  const saveMut = useMutation({
    mutationFn: (vars: { id: string; amount_cents: number; active: boolean }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Shipping rate saved");
      qc.invalidateQueries({ queryKey: ["shipping-rates-admin"] });
      qc.invalidateQueries({ queryKey: ["shipping-rates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = (r: ShippingRateRow) => {
    const draft = drafts[r.id];
    if (!draft) return;
    const dollars = Number(draft.amountDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Enter a valid price");
      return;
    }
    saveMut.mutate({
      id: r.id,
      amount_cents: Math.round(dollars * 100),
      active: draft.active,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium">Shipping rates</h2>
        <p className="text-sm text-muted-foreground">
          Flat-rate shipping charges per destination region. Kit bands cover the practitioner kit cartons, table bands cover the fitted Resonabed for Home table freight.
          Country groupings are managed in the database.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Regions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (rates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipping regions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Countries</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>Price (AUD)</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).map((r) => {
                  const draft = drafts[r.id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="text-brand-indigo">
                          {r.label}
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {r.applies_to === "any"
                              ? "All orders"
                              : (PACKAGE_LABELS[r.applies_to] ?? r.applies_to)}
                          </span>
                        </div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {r.region}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.allowed_countries.join(", ")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.gst_inclusive ? "Incl." : "Export"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft?.amountDollars ?? ""}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [r.id]: {
                                  ...(prev[r.id] ?? { active: r.active, amountDollars: "" }),
                                  amountDollars: e.target.value,
                                },
                              }))
                            }
                            className="h-9 w-28"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={draft?.active ?? r.active}
                          onCheckedChange={(v) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.id]: {
                                ...(prev[r.id] ?? {
                                  amountDollars: (r.amount_cents / 100).toFixed(2),
                                  active: r.active,
                                }),
                                active: v,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSave(r)}
                          disabled={saveMut.isPending}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
