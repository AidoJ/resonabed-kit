DROP POLICY IF EXISTS "app_settings_read_authenticated" ON public.app_settings;

CREATE POLICY "app_settings_read_super_admin"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "app_settings_read_public_prices"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (key IN ('music_renewal_price_display', 'order_deposit_cents'));