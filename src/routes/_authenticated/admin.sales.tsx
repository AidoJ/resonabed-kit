import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listKitSales } from "@/lib/sales.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({
    meta: [
      { title: "Kit sales, Admin, ResonaBed" },
      {
        name: "description",
        content: "Website kit sales: prices, promo discounts, shipping and GST collected.",
      },
    ],
  }),
  component: SalesAdmin,
});

const money = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SalesAdmin() {
  const fetchSales = useServerFn(listKitSales);
  const { data, isLoading, error } = useQuery({
    queryKey: ["kit-sales"],
    queryFn: () => fetchSales(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading sales…</p>;
  if (error)
    return (
      <p className="text-sm text-destructive">
        Could not load sales: {(error as Error).message}
      </p>
    );

  const rows = data?.rows ?? [];
  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Kit sales</h2>
        <p className="text-sm text-muted-foreground">
          Completed website checkouts. Amounts are GST-inclusive; GST is 1/11 of the taxable
          portion (export shipping is GST-free).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Orders" value={String(s?.orders ?? 0)} />
        <Stat
          label="Collected"
          value={money(s?.collectedCents ?? 0)}
          hint="Paid at checkout (deposit only for plans)"
        />
        <Stat
          label="Contract value"
          value={money(s?.contractCents ?? 0)}
          hint="Incl. scheduled instalments"
        />
        <Stat label="Discounts" value={money(s?.discountCents ?? 0)} hint="Promo codes applied" />
        <Stat label="GST collected" value={money(s?.gstCents ?? 0)} hint="On collected amounts" />
      </div>

      {(s?.byPackage.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {s!.byPackage.map((p) => (
            <Badge key={p.key} variant="secondary" className="text-xs">
              {p.label}: {p.count} · {money(p.collectedCents)}
            </Badge>
          ))}
          <Badge variant="secondary" className="text-xs">
            Shipping: {money(s?.shippingCents ?? 0)}
          </Badge>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">List price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Shipping</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Contract total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-sm text-muted-foreground">
                  No completed kit orders yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.created).toLocaleDateString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-40">
                      <div>{r.customerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.customerEmail ?? ""}</div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.packageLabel}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.plan === "installments" ? (
                      <Badge variant="outline">Plan · {r.monthsRemainingPlan} mo</Badge>
                    ) : (
                      <Badge variant="secondary">Paid in full</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {money(r.listCents, r.currency)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.discountCents > 0 ? (
                      <div>
                        <div>-{money(r.discountCents, r.currency)}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.promoCode} {r.promoPercent ? `(${r.promoPercent}%)` : ""}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div>{r.shippingCents > 0 ? money(r.shippingCents, r.currency) : "Pickup"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.shippingRegion
                        ? r.shippingGstInclusive
                          ? `${r.shippingRegion.toUpperCase()} · incl. GST`
                          : `${r.shippingRegion.toUpperCase()} · GST-free`
                        : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium">
                    {money(r.collectedCents, r.currency)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {money(r.gstCents, r.currency)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {money(r.contractCents, r.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
