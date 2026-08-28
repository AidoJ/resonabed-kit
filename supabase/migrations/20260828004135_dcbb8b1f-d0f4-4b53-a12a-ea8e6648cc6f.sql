ALTER TABLE public.kit_package_prices
  ADD COLUMN IF NOT EXISTS plan_list_cents integer;

UPDATE public.kit_package_prices
  SET plan_list_cents = list_cents + 10000,
      plan_deposit_balance_cents = plan_deposit_balance_cents + 10000
  WHERE plan_list_cents IS NULL;

ALTER TABLE public.kit_package_prices
  ALTER COLUMN plan_list_cents SET NOT NULL;