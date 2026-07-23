CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent integer NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 99),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions >= 1),
  times_redeemed integer NOT NULL DEFAULT 0 CHECK (times_redeemed >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_code_format CHECK (code ~ '^[A-Z0-9_-]{3,40}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Super admins can manage promo codes"
ON public.promo_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS promo_codes_set_updated_at ON public.promo_codes;
CREATE TRIGGER promo_codes_set_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS promo_codes_active_code_idx ON public.promo_codes (code) WHERE active = true;