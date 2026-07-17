
-- ============================================================================
-- Phase 6a: Role separation — hybrid global services + support-mode audit
-- ============================================================================

-- 1. Services: allow global (org_id IS NULL) rows managed by super_admin.
--    Existing org-scoped rows keep their prices and remain the authoritative
--    price source. Global rows are the template copied on org creation.

ALTER TABLE public.services ALTER COLUMN org_id DROP NOT NULL;

-- Global services carry only default duration/buffer/name; price stays 0 as a
-- non-authoritative default (each clinic sets its own price on the copied row).

DROP POLICY IF EXISTS services_select ON public.services;
DROP POLICY IF EXISTS services_insert ON public.services;
DROP POLICY IF EXISTS services_update ON public.services;
DROP POLICY IF EXISTS services_delete ON public.services;

-- Any authenticated user can read global rows (needed to preview the catalogue
-- before org creation) and their own org rows. Super_admin sees everything.
CREATE POLICY services_select ON public.services
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR org_id IS NULL
  OR org_id = public.current_org_id()
);

-- Global rows: super_admin only. Org rows: org member or super_admin.
CREATE POLICY services_insert ON public.services
FOR INSERT TO authenticated
WITH CHECK (
  (org_id IS NULL AND public.is_super_admin(auth.uid()))
  OR (org_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR org_id = public.current_org_id()))
);

CREATE POLICY services_update ON public.services
FOR UPDATE TO authenticated
USING (
  (org_id IS NULL AND public.is_super_admin(auth.uid()))
  OR (org_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR org_id = public.current_org_id()))
)
WITH CHECK (
  (org_id IS NULL AND public.is_super_admin(auth.uid()))
  OR (org_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR org_id = public.current_org_id()))
);

CREATE POLICY services_delete ON public.services
FOR DELETE TO authenticated
USING (
  (org_id IS NULL AND public.is_super_admin(auth.uid()))
  OR (org_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR org_id = public.current_org_id()))
);


-- 2. support_sessions — append-only audit log of platform access to org data.
--    Rows are inserted on enter, updated ONCE to set exited_at on exit,
--    and NEVER deletable via the app. This is the trust record shown to
--    clinics: every time Resonabed accessed their clinic and why.

CREATE TABLE public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  reason TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_sessions_exit_after_enter CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE INDEX support_sessions_org_id_idx ON public.support_sessions(org_id, entered_at DESC);
CREATE INDEX support_sessions_super_admin_id_idx ON public.support_sessions(super_admin_id, entered_at DESC);
-- Only one open (un-exited) session per super_admin at a time.
CREATE UNIQUE INDEX support_sessions_one_active_per_admin
  ON public.support_sessions(super_admin_id) WHERE exited_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.support_sessions TO authenticated;
GRANT ALL ON public.support_sessions TO service_role;
-- Deliberately NO delete grant to any role except service_role for maintenance.

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin sees all; org_admins see their own org's rows (so
-- clinics can audit platform access to their data).
CREATE POLICY support_sessions_select ON public.support_sessions
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), org_id)
);

-- INSERT: only super_admin, only as themselves.
CREATE POLICY support_sessions_insert ON public.support_sessions
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  AND super_admin_id = auth.uid()
);

-- UPDATE: only the super_admin who opened it, only to set exited_at,
-- only when it is currently open. Enforced via trigger below.
CREATE POLICY support_sessions_update ON public.support_sessions
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) AND super_admin_id = auth.uid() AND exited_at IS NULL)
WITH CHECK (public.is_super_admin(auth.uid()) AND super_admin_id = auth.uid());

-- No DELETE policy — rows are immutable once created.

-- Immutability trigger: reject any change to identity/entered fields, and
-- reject overwriting exited_at once it is set.
CREATE OR REPLACE FUNCTION public.support_sessions_enforce_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.super_admin_id IS DISTINCT FROM OLD.super_admin_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.entered_at IS DISTINCT FROM OLD.entered_at
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'support_sessions rows are append-only; only exited_at may be set on exit';
  END IF;
  IF OLD.exited_at IS NOT NULL AND NEW.exited_at IS DISTINCT FROM OLD.exited_at THEN
    RAISE EXCEPTION 'support_sessions.exited_at is write-once';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.support_sessions_enforce_immutability() FROM PUBLIC;

CREATE TRIGGER support_sessions_immutability
BEFORE UPDATE ON public.support_sessions
FOR EACH ROW EXECUTE FUNCTION public.support_sessions_enforce_immutability();

CREATE TRIGGER support_sessions_set_updated_at
BEFORE UPDATE ON public.support_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. Seed a starter global services catalogue (super_admin can edit/add later).
--    Prices are 0 by design — each clinic sets its own price on the copied row.

INSERT INTO public.services (org_id, name, duration_minutes, buffer_minutes, price, is_active)
VALUES
  (NULL, 'Standard session',        45, 15, 0, true),
  (NULL, 'Extended session',        60, 15, 0, true),
  (NULL, 'Introductory session',    30, 15, 0, true),
  (NULL, 'Deep relaxation session', 75, 20, 0, true)
ON CONFLICT DO NOTHING;
