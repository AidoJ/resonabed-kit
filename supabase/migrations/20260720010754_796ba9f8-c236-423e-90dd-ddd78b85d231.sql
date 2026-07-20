
-- 1. Grants table
CREATE TABLE public.support_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_grant_expiry_after_grant CHECK (expires_at > granted_at)
);

CREATE INDEX support_access_grants_org_active_idx
  ON public.support_access_grants (org_id, expires_at)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.support_access_grants TO authenticated;
GRANT ALL ON public.support_access_grants TO service_role;

ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

-- Org admins see their org's grants; super admins see all
CREATE POLICY "read own org grants" ON public.support_access_grants
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- Only org admins of the same org can create grants; granted_by must be self
CREATE POLICY "org admin creates grants" ON public.support_access_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid(), org_id)
    AND granted_by = auth.uid()
  );

-- Only org admins can revoke (i.e. UPDATE) their own org's grants
CREATE POLICY "org admin revokes grants" ON public.support_access_grants
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE TRIGGER support_access_grants_set_updated_at
  BEFORE UPDATE ON public.support_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Extend support_sessions
ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS emergency BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grant_id UUID REFERENCES public.support_access_grants(id) ON DELETE SET NULL;

-- Update immutability trigger to protect the new columns after insert
CREATE OR REPLACE FUNCTION public.support_sessions_enforce_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.super_admin_id IS DISTINCT FROM OLD.super_admin_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.entered_at IS DISTINCT FROM OLD.entered_at
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.emergency IS DISTINCT FROM OLD.emergency
     OR NEW.grant_id IS DISTINCT FROM OLD.grant_id THEN
    RAISE EXCEPTION 'support_sessions rows are append-only; only exited_at may be set on exit';
  END IF;
  IF OLD.exited_at IS NOT NULL AND NEW.exited_at IS DISTINCT FROM OLD.exited_at THEN
    RAISE EXCEPTION 'support_sessions.exited_at is write-once';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Helper: is there an active grant right now?
CREATE OR REPLACE FUNCTION public.org_has_active_support_grant(_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE org_id = _org_id
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$function$;
