ALTER TABLE public.promo_codes ADD COLUMN fixed_amount_cents integer;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_fixed_amount_positive CHECK (fixed_amount_cents IS NULL OR fixed_amount_cents > 0);
COMMENT ON COLUMN public.promo_codes.fixed_amount_cents IS 'When set, this fixed AUD amount in cents is the discount instead of discount_percent. NULL preserves existing percentage codes.';
COMMENT ON COLUMN public.promo_codes.discount_percent IS 'Percentage discount when fixed_amount_cents is NULL; retained as a compatibility placeholder for fixed-amount codes.';