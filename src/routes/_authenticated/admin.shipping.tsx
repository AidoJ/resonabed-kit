import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  listShippingRatesAdmin,
  updateShippingRate,
  createShippingRate,
  deleteShippingRate,
  type ShippingRateRow,
} from "@/lib/shipping.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Truck } from "lucide-react";
import { PACKAGE_LABELS } from "@/lib/packages";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  head: () => ({ meta: [{ title: "Shipping rates, ResonaBed" }] }),
  component: ShippingRatesPage,
});

const APPLIES_TO_OPTIONS = [
  { value: "any", label: "All orders" },
  { value: "essentials", label: PACKAGE_LABELS["essentials"] ?? "Basic" },
  { value: "pro", label: PACKAGE_LABELS["pro"] ?? "Pro" },
  { value: "platinum", label: PACKAGE_LABELS["platinum"] ?? "Platinum" },
  { value: "home", label: PACKAGE_LABELS["home"] ?? "Home" },
];

type Draft = {
  region: string;
  label: string;
  amountDollars: string;
  gst_inclusive: boolean;
  countries: string;
  states: string;
  applies_to: string;
  sortOrder: string;
  active: boolean;
};

const toDraft = (r: ShippingRateRow): Draft => ({
  region: r.region,
  label: r.label,
  amountDollars: (r.amount_cents / 100).toFixed(2),
  gst_inclusive: r.gst_inclusive,
  countries: (r.allowed_countries ?? []).join(", "),
  states: (r.allowed_states ?? []).join(", "),
  applies_to: r.applies_to,
  sortOrder: String(r.sort_order),
  active: r.active,
});

const parseList = (s: string) =>
  s
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);

const emptyDraft: Draft = {
  region: "",
  label: "",
  amountDollars: "0.00",
  gst_inclusive: true,
  countries: "AU",
  states: "",
  applies_to: "essentials",
  sortOrder: "500",
  active: true,
};

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
      for (const r of rates) if (!next[r.id]) next[r.id] = toDraft(r);
      return next;
    });
  }, [rates]);

  const patch = (id: string, r: ShippingRateRow, values: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? toDraft(r)), ...values } }));

  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shipping-rates-admin"] });
    qc.invalidateQueries({ queryKey: ["shipping-rates"] });
  };

  const updateFn = useServerFn(updateShippingRate);
  const saveMut = useMutation({
    mutationFn: (vars: Record<string, unknown>) => updateFn({ data: vars as never }),
    onSuccess: () => {
      toast.success("Shipping rate saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteShippingRate);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Shipping rate deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createFn = useServerFn(createShippingRate);
  const [addOpen, setAddOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const createMut = useMutation({
    mutationFn: (vars: Record<string, unknown>) => createFn({ data: vars as never }),
    onSuccess: () => {
      toast.success("Shipping rate added");
      setAddOpen(false);
      setNewDraft(emptyDraft);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draftToPayload = (d: Draft) => {
    const dollars = Number(d.amountDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Enter a valid price");
      return null;
    }
    if (!d.region.trim() || !d.label.trim()) {
      toast.error("Region key and label are required");
      return null;
    }
    const countries = parseList(d.countries);
    if (countries.length === 0) {
      toast.error("Add at least one country code");
      return null;
    }
    const sort = Number(d.sortOrder);
    return {
      region: d.region.trim(),
      label: d.label.trim(),
      amount_cents: Math.round(dollars * 100),
      gst_inclusive: d.gst_inclusive,
      allowed_countries: countries,
      allowed_states: parseList(d.states),
      applies_to: d.applies_to,
      sort_order: Number.isFinite(sort) ? sort : 500,
      active: d.active,
    };
  };

  const handleSave = (r: ShippingRateRow) => {
    const draft = drafts[r.id];
    if (!draft) return;
    const payload = draftToPayload(draft);
    if (!payload) return;
    saveMut.mutate({ id: r.id, ...payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">Shipping rates</h2>
          <p className="text-sm text-muted-foreground">
            Flat-rate shipping charges per destination region. Each package has its own bands, so
            freight can be tuned per product weight and size. Country and state codes are
            comma-separated (leave states blank to cover the whole country).
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add rate
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Regions
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (rates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipping regions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Label</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead className="min-w-[160px]">Countries</TableHead>
                  <TableHead className="min-w-[130px]">States</TableHead>
                  <TableHead>GST incl.</TableHead>
                  <TableHead>Price (AUD)</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).map((r) => {
                  const d = drafts[r.id] ?? toDraft(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Input
                          value={d.label}
                          onChange={(e) => patch(r.id, r, { label: e.target.value })}
                          className="h-9"
                        />
                        <Input
                          value={d.region}
                          onChange={(e) => patch(r.id, r, { region: e.target.value })}
                          className="mt-1 h-7 text-xs uppercase tracking-wider text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={d.applies_to}
                          onValueChange={(v) => patch(r.id, r, { applies_to: v })}
                        >
                          <SelectTrigger className="h-9 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPLIES_TO_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={d.countries}
                          onChange={(e) => patch(r.id, r, { countries: e.target.value })}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={d.states}
                          placeholder="All"
                          onChange={(e) => patch(r.id, r, { states: e.target.value })}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={d.gst_inclusive}
                          onCheckedChange={(v) => patch(r.id, r, { gst_inclusive: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={d.amountDollars}
                            onChange={(e) => patch(r.id, r, { amountDollars: e.target.value })}
                            className="h-9 w-28"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={d.sortOrder}
                          onChange={(e) => patch(r.id, r, { sortOrder: e.target.value })}
                          className="h-9 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={d.active}
                          onCheckedChange={(v) => patch(r.id, r, { active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(r)}
                            disabled={saveMut.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${r.label}`}
                            onClick={() => {
                              if (confirm(`Delete the "${r.label}" shipping rate?`)) {
                                deleteMut.mutate(r.id);
                              }
                            }}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add shipping rate</DialogTitle>
            <DialogDescription>
              A rate applies when the buyer's country (and state, if listed) matches and the
              package matches the "applies to" selection.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="new-label">Label shown to buyers</Label>
              <Input
                id="new-label"
                value={newDraft.label}
                onChange={(e) => setNewDraft((p) => ({ ...p, label: e.target.value }))}
                placeholder="Australia, regional"
              />
            </div>
            <div>
              <Label htmlFor="new-region">Region key</Label>
              <Input
                id="new-region"
                value={newDraft.region}
                onChange={(e) => setNewDraft((p) => ({ ...p, region: e.target.value }))}
                placeholder="pro-au-regional"
              />
            </div>
            <div>
              <Label>Applies to</Label>
              <Select
                value={newDraft.applies_to}
                onValueChange={(v) => setNewDraft((p) => ({ ...p, applies_to: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLIES_TO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-countries">Countries</Label>
              <Input
                id="new-countries"
                value={newDraft.countries}
                onChange={(e) => setNewDraft((p) => ({ ...p, countries: e.target.value }))}
                placeholder="AU, NZ"
              />
            </div>
            <div>
              <Label htmlFor="new-states">States (optional)</Label>
              <Input
                id="new-states"
                value={newDraft.states}
                onChange={(e) => setNewDraft((p) => ({ ...p, states: e.target.value }))}
                placeholder="QLD, NSW"
              />
            </div>
            <div>
              <Label htmlFor="new-amount">Price (AUD)</Label>
              <Input
                id="new-amount"
                type="number"
                min={0}
                step="0.01"
                value={newDraft.amountDollars}
                onChange={(e) => setNewDraft((p) => ({ ...p, amountDollars: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-sort">Sort order</Label>
              <Input
                id="new-sort"
                type="number"
                value={newDraft.sortOrder}
                onChange={(e) => setNewDraft((p) => ({ ...p, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="new-gst">GST inclusive</Label>
              <Switch
                id="new-gst"
                checked={newDraft.gst_inclusive}
                onCheckedChange={(v) => setNewDraft((p) => ({ ...p, gst_inclusive: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="new-active">Active</Label>
              <Switch
                id="new-active"
                checked={newDraft.active}
                onCheckedChange={(v) => setNewDraft((p) => ({ ...p, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMut.isPending}
              onClick={() => {
                const payload = draftToPayload(newDraft);
                if (payload) createMut.mutate(payload);
              }}
            >
              Add rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
