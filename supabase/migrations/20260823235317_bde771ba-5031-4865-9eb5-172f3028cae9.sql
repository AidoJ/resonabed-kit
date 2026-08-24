GRANT SELECT ON public.app_settings TO anon;

CREATE POLICY app_settings_public_deposit_read
  ON public.app_settings FOR SELECT
  TO anon
  USING (key = 'order_deposit_cents');