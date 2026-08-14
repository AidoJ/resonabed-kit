CREATE SEQUENCE IF NOT EXISTS public.kit_order_seq START 1;

CREATE OR REPLACE FUNCTION public.next_kit_order_number()
RETURNS text
LANGUAGE sql
SET search_path TO 'public'
AS $$
  select 'ORD-' || lpad(nextval('public.kit_order_seq')::text, 5, '0')
$$;

CREATE TABLE public.kit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'draft',
  package_key text NOT NULL,
  package_label text NOT NULL,
  buyer_type text NOT NULL DEFAULT 'personal',
  business_name text,
  abn text,
  contact_name text,
  contact_email text,
  contact_phone text,
  pickup boolean NOT NULL DEFAULT false,
  shipping_address text,
  shipping_region text,
  shipping_label text,
  shipping_cents integer NOT NULL DEFAULT 0,
  shipping_gst_inclusive boolean NOT NULL DEFAULT false,
  shipping_charged_at timestamptz,
  promo_code text,
  promo_code_id uuid,
  promo_percent integer,
  discount_cents integer NOT NULL DEFAULT 0,
  payment_channel text NOT NULL DEFAULT 'card',
  path text,
  list_cents integer NOT NULL,
  deposit_cents integer NOT NULL DEFAULT 10000,
  balance_cents integer NOT NULL DEFAULT 0,
  plan_deposit_balance_cents integer,
  plan_monthly_cents integer,
  plan_months integer,
  collected_cents integer NOT NULL DEFAULT 0,
  contract_cents integer NOT NULL DEFAULT 0,
  gst_cents integer NOT NULL DEFAULT 0,
  ships_kit boolean NOT NULL DEFAULT true,
  ships_table boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  stripe_deposit_session_id text,
  stripe_deposit_payment_intent text,
  stripe_balance_session_id text,
  stripe_balance_payment_intent text,
  stripe_subscription_id text,
  payments_made integer NOT NULL DEFAULT 0,
  payments_due integer NOT NULL DEFAULT 0,
  arrears_since timestamptz,
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,
  plan_started_at timestamptz,
  plan_completed_at timestamptz,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  refund_cents integer,
  reminder_7_sent_at timestamptz,
  reminder_25_sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kit_orders_state_idx ON public.kit_orders (state);
CREATE INDEX kit_orders_deposit_session_idx ON public.kit_orders (stripe_deposit_session_id);
CREATE INDEX kit_orders_balance_session_idx ON public.kit_orders (stripe_balance_session_id);
CREATE INDEX kit_orders_subscription_idx ON public.kit_orders (stripe_subscription_id);

GRANT SELECT ON public.kit_orders TO authenticated;
GRANT ALL ON public.kit_orders TO service_role;
ALTER TABLE public.kit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view kit orders"
ON public.kit_orders FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER kit_orders_set_updated_at
BEFORE UPDATE ON public.kit_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kit_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.kit_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state text,
  to_state text,
  stripe_ref text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kit_order_events_order_idx ON public.kit_order_events (order_id, created_at DESC);

GRANT SELECT ON public.kit_order_events TO authenticated;
GRANT ALL ON public.kit_order_events TO service_role;
ALTER TABLE public.kit_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view kit order events"
ON public.kit_order_events FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

ALTER TABLE public.kit_invoices
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.kit_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'legacy';