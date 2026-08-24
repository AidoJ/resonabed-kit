# Editable package pricing

Today the four package prices ($1,199 Basic, $1,399 Pro, $1,799 Platinum, $1,499 Home) plus the
deposit, plan deposit-balance and monthly amounts are written into the code in about seven places.
Changing a price means a code change. This makes prices data you can edit from the admin area, with
the current numbers as the starting values.

## What you get

- A new **Pricing** page in the platform admin (super admin only) listing all four packages.
- For each package you can edit: full price (incl. GST), payment-plan deposit balance, monthly
  amount, and number of monthly payments. The order deposit ($100) is editable once, globally.
- Live preview per package while editing: balance after deposit, plan total, GST split, and a
  warning if the plan total is less than the full price.
- Everything downstream reads the saved numbers: marketing page cards, Home panel, compare table,
  Stripe checkout (deposit, balance, plan), bank-transfer invoices, manual invoices and sales
  reporting.
- Existing orders are untouched — each order already stores the price it was sold at, so changing a
  price only affects new orders.

## How it works

1. **Database**: new `kit_package_prices` table, one row per package key
   (`essentials`, `pro`, `platinum`, `home`) with `list_cents`, `plan_deposit_balance_cents`,
   `plan_monthly_cents`, `plan_months`, plus a single `order_deposit_cents` app setting. Seeded by
   migration with today's exact values so nothing changes on release. Read access granted to `anon`
   and `authenticated` (prices are public); writes restricted to super admins.

2. **Server**: `src/lib/packages.ts` keeps the static definitions (labels, descriptions, shipping
   scope, shipsTable) as defaults. A new `src/lib/pricing.server.ts` loads the price rows and
   merges them over the defaults; `checkout.server.ts`, `orders.server.ts`, `eft-order.server.ts`,
   `kit-invoicing.server.ts` and `sales.server.ts` switch from the hardcoded constants to that
   resolver. Duplicated price maps in those files are deleted.

3. **Public pricing for the site**: a public server function returns the price rows; the marketing
   route (`/`) and `/for-home` load it in their loader and pass it down. `PackageCard`,
   `HomeOrderPanel` and `ShippingAddressStepDialog` take prices as props instead of constants, and
   the price strings and GST lines ("$1,090 + $109 GST = $1,199") are computed rather than typed.

4. **Admin UI**: `/admin/pricing` under the platform admin nav, with save-per-package and a
   confirmation on save. Server function validates amounts (positive integers, plan total ≥ list
   price is a warning not a block) and is guarded by the super-admin role check.

## Notes

- Prices remain GST-inclusive AUD; GST is derived as 1/11 as it is today.
- Shipping rates are already editable and are left as they are.
- Changing a price does not touch Stripe subscriptions already running on a plan.
