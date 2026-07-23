ALTER TABLE public.promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_discount_percent_check;

ALTER TABLE public.promo_codes
  ADD CONSTRAINT promo_codes_discount_percent_check CHECK (discount_percent >= 1 AND discount_percent <= 100);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  amount_discounted_cents integer NOT NULL DEFAULT 0 CHECK (amount_discounted_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.promo_code_redemptions TO service_role;

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;