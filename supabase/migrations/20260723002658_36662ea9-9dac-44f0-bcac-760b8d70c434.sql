GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
GRANT SELECT, INSERT ON public.promo_code_redemptions TO authenticated;
GRANT ALL ON public.promo_code_redemptions TO service_role;