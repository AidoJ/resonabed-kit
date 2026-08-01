-- ============================================================
-- HOME USER APP: access codes, home accounts, safety acks
-- Deliberately isolated from all clinic/health tables.
-- ============================================================

CREATE TABLE public.kit_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  buyer_email text NOT NULL,
  buyer_phone text,
  buyer_name text,
  package_key text,
  source text NOT NULL DEFAULT 'stripe',
  source_ref text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','revoked','redeemed')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  replaced_by_id uuid REFERENCES public.kit_access_codes(id),
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One live (issued or redeemed) code per underlying order. Regeneration
-- revokes the old row first, so the replacement inserts cleanly.
CREATE UNIQUE INDEX kit_access_codes_live_source_ref
  ON public.kit_access_codes (source, source_ref)
  WHERE source_ref IS NOT NULL AND status IN ('issued','redeemed');

CREATE INDEX kit_access_codes_email_idx ON public.kit_access_codes (lower(buyer_email));

GRANT SELECT ON public.kit_access_codes TO authenticated;
GRANT ALL ON public.kit_access_codes TO service_role;
ALTER TABLE public.kit_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read access codes"
  ON public.kit_access_codes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER kit_access_codes_set_updated_at
  BEFORE UPDATE ON public.kit_access_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------

CREATE TABLE public.home_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_code_id uuid NOT NULL UNIQUE REFERENCES public.kit_access_codes(id),
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_accounts TO authenticated;
GRANT ALL ON public.home_accounts TO service_role;
ALTER TABLE public.home_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Home users read their own account"
  ON public.home_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER home_accounts_set_updated_at
  BEFORE UPDATE ON public.home_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Marker function: this login is a personal/home account, not a clinic one.
CREATE OR REPLACE FUNCTION public.is_home_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.home_accounts WHERE user_id = _user_id)
$$;

-- ------------------------------------------------------------
-- Append-only safety acknowledgement. Stores NO health detail:
-- who, which version, when, signature. Nothing else.

CREATE TABLE public.home_safety_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  signature text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX home_safety_ack_user_idx
  ON public.home_safety_acknowledgements (user_id, acknowledged_at DESC);

GRANT SELECT, INSERT ON public.home_safety_acknowledgements TO authenticated;
GRANT SELECT, INSERT ON public.home_safety_acknowledgements TO service_role;
ALTER TABLE public.home_safety_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Home users read their own acknowledgements"
  ON public.home_safety_acknowledgements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Home users write their own acknowledgement"
  ON public.home_safety_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_home_user(auth.uid()));
