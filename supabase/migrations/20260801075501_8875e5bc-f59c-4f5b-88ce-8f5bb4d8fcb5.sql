CREATE TABLE public.kit_onboarding_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'stripe',
  source_ref text,
  business_name text,
  abn text,
  contact_name text,
  contact_email text NOT NULL,
  contact_phone text,
  package_key text,
  plan text,
  shipping_address text,
  amount_cents integer,
  status text NOT NULL DEFAULT 'pending',
  org_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  provisioned_by uuid REFERENCES auth.users(id),
  provisioned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_onboarding_orders_status_chk CHECK (status IN ('pending','provisioned','dismissed')),
  CONSTRAINT kit_onboarding_orders_source_chk CHECK (source IN ('stripe','eft','manual'))
);

CREATE UNIQUE INDEX kit_onboarding_orders_source_ref_uidx
  ON public.kit_onboarding_orders (source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX kit_onboarding_orders_status_idx
  ON public.kit_onboarding_orders (status, created_at DESC);

GRANT SELECT, UPDATE ON public.kit_onboarding_orders TO authenticated;
GRANT ALL ON public.kit_onboarding_orders TO service_role;

ALTER TABLE public.kit_onboarding_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view onboarding orders"
  ON public.kit_onboarding_orders FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Platform admins can update onboarding orders"
  ON public.kit_onboarding_orders FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER kit_onboarding_orders_set_updated_at
  BEFORE UPDATE ON public.kit_onboarding_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kit_invoices
  ADD COLUMN buyer_type text NOT NULL DEFAULT 'personal',
  ADD COLUMN business_name text,
  ADD COLUMN abn text;

ALTER TABLE public.kit_invoices
  ADD CONSTRAINT kit_invoices_buyer_type_chk CHECK (buyer_type IN ('personal','business'));

ALTER TABLE public.kit_access_codes
  ADD COLUMN buyer_type text NOT NULL DEFAULT 'personal';

ALTER TABLE public.kit_access_codes
  ADD CONSTRAINT kit_access_codes_buyer_type_chk CHECK (buyer_type IN ('personal','business'));