import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  listPromoCodes,
  createPromoCode,
  setPromoCodeActive,
} from "@/lib/promo-codes.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Tag, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/promo-codes")({
  head: () => ({
    meta: [
      { title: "Promo codes, ResonaBed" },
      { name: "description", content: "Create and manage promotional discount codes for kit checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PromoCodesPage,
});

function PromoCodesPage() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
  });

  if (!ctxLoading && !ctx?.roles.includes("super_admin")) {
    throw redirect({ to: "/dashboard" });
  }

  const fetchPromos = useServerFn(listPromoCodes);
  const { data: promos, isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => fetchPromos(),
    enabled: !!ctx?.roles.includes("super_admin"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const qc = useQueryClient();
  const createFn = useServerFn(createPromoCode);
  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          code: code.trim(),
          percent_off: Number(percentOff),
          max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Promo code created");
      setCode("");
      setPercentOff("10");
      setMaxRedemptions("");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFn = useServerFn(setPromoCodeActive);
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleFn({ data: { id, active } }),
    onSuccess: (_, vars) => {
      toast.success(vars.active ? "Promo code activated" : "Promo code deactivated");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const isValid =
    code.trim().length >= 3 &&
    /^[A-Z0-9_-]+$/i.test(code.trim()) &&
    !Number.isNaN(Number(percentOff)) &&
    Number(percentOff) >= 1 &&
    Number(percentOff) <= 99 &&
    (maxRedemptions === "" ||
      (!Number.isNaN(Number(maxRedemptions)) && Number(maxRedemptions) >= 1));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Promo codes</h2>
          <p className="text-sm text-muted-foreground">
            Percentage discounts that customers can apply at checkout on the Pro or Premium kit.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New promo code
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            Active codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (promos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No promo codes yet. Create one to start offering discounts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(promos ?? []).map((pc) => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {pc.code}
                        <button
                          onClick={() => handleCopy(pc.code)}
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          title="Copy code"
                        >
                          {copied === pc.code ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{pc.percent_off}% off</TableCell>
                    <TableCell>
                      {pc.times_redeemed}
                      {pc.max_redemptions !== null ? ` / ${pc.max_redemptions}` : " unlimited"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pc.active ? "default" : "secondary"}>
                        {pc.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Switch
                          checked={pc.active}
                          onCheckedChange={(v) =>
                            toggleMut.mutate({ id: pc.id, active: v })
                          }
                          disabled={toggleMut.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create promo code</DialogTitle>
            <DialogDescription>
              Customers enter this code at checkout. It applies to both the Pro and Premium kits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER20"
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, dashes and underscores only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="percent">Percent off</Label>
              <Input
                id="percent"
                type="number"
                min={1}
                max={99}
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max redemptions (optional)</Label>
              <Input
                id="max"
                type="number"
                min={1}
                placeholder="Unlimited if left blank"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!isValid || createMut.isPending}
            >
              {createMut.isPending ? "Creating…" : "Create code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
