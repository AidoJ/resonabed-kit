CREATE TABLE public.kit_package_prices (
  package_key TEXT NOT NULL PRIMARY KEY CHECK (package_key IN ('essentials','pro','platinum','home')),
  list_cents INTEGER NOT NULL CHECK (list_cents > 0),
  plan_deposit_balance_cents INTEGER NOT NULL CHECK (plan_deposit_balance_cents > 0),
  plan_monthly_cents INTEGER NOT NULL CHECK (plan_monthly_cents > 0),
  plan_months INTEGER NOT NULL CHECK (plan_months BETWEEN 1 AND 36),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.kit_package_prices TO anon;
GRANT SELECT ON public.kit_package_prices TO authenticated;
GRANT ALL ON public.kit_package_prices TO service_role;

ALTER TABLE public.kit_package_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY kit_package_prices_public_read
  ON public.kit_package_prices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY kit_package_prices_super_admin_write
  ON public.kit_package_prices FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER kit_package_prices_set_updated_at
  BEFORE UPDATE ON public.kit_package_prices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO public.kit_package_prices (package_key, list_cents, plan_deposit_balance_cents, plan_monthly_cents, plan_months)
VALUES
  ('essentials', 119900, 29900, 9000, 10),
  ('pro',        139900, 29900, 11000, 10),
  ('platinum',   179900, 49900, 13000, 10),
  ('home',       149900, 39900, 11000, 10);

INSERT INTO public.app_settings (key, value)
VALUES ('order_deposit_cents', '10000')
ON CONFLICT (key) DO NOTHING;