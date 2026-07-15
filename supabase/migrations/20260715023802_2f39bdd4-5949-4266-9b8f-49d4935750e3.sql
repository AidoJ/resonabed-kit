
-- 1. Extend organisations with setup & policy fields
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS abn text,
  ADD COLUMN IF NOT EXISTS consent_text text,
  ADD COLUMN IF NOT EXISTS consent_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS privacy_policy_text text,
  ADD COLUMN IF NOT EXISTS health_policy_text text,
  ADD COLUMN IF NOT EXISTS is_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS configured_at timestamptz,
  ADD COLUMN IF NOT EXISTS configured_acknowledgement_by text,
  ADD COLUMN IF NOT EXISTS configured_acknowledgement_at timestamptz;

-- Sample placeholder wording used for any new/legacy org that has no policy yet
UPDATE public.organisations SET
  consent_text = COALESCE(consent_text,
    'SAMPLE — replace with your own reviewed wording before go-live.

I consent to receiving a vibroacoustic therapy session at this clinic. I understand this is a wellbeing service and not a medical treatment, that I have disclosed any relevant health conditions, and that I may stop the session at any time.'),
  privacy_policy_text = COALESCE(privacy_policy_text,
    'SAMPLE — replace with your own reviewed wording before go-live.

This clinic collects your contact details and session notes to deliver your care. Your information is kept confidential and is not shared with third parties except as required by law.'),
  health_policy_text = COALESCE(health_policy_text,
    'SAMPLE — replace with your own reviewed wording before go-live.

Vibroacoustic sessions are intended for relaxation and general wellbeing. They are not a substitute for medical advice. Please disclose pregnancy, pacemakers, recent surgery, epilepsy, or any other significant health concerns before your session.'),
  business_name = COALESCE(business_name, name);

-- 2. Audit log for policy edits (immutable append)
CREATE TABLE IF NOT EXISTS public.org_policy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  edited_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.org_policy_audit TO authenticated;
GRANT ALL ON public.org_policy_audit TO service_role;

ALTER TABLE public.org_policy_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_audit_select" ON public.org_policy_audit
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (org_id = public.current_org_id() AND public.is_org_admin(auth.uid(), org_id))
  );

CREATE POLICY "policy_audit_insert" ON public.org_policy_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (org_id = public.current_org_id() AND public.is_org_admin(auth.uid(), org_id))
  );

CREATE INDEX IF NOT EXISTS org_policy_audit_org_idx ON public.org_policy_audit(org_id, created_at DESC);

-- 3. Server-side go-live gate: block session inserts when org not configured
CREATE OR REPLACE FUNCTION public.sessions_require_configured_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_configured boolean;
BEGIN
  SELECT is_configured INTO v_configured FROM public.organisations WHERE id = NEW.org_id;
  IF NOT COALESCE(v_configured, false) THEN
    RAISE EXCEPTION 'organisation_not_configured'
      USING HINT = 'The organisation admin must complete setup and acknowledgement before sessions can be created.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_require_configured_org_trg ON public.sessions;
CREATE TRIGGER sessions_require_configured_org_trg
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_require_configured_org();
