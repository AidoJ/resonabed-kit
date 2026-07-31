-- ============ Screenings (append-only) ============
CREATE TABLE public.client_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE SET NULL,
  client_id uuid NOT NULL,
  practitioner_id uuid NOT NULL,
  booking_id uuid,
  checklist_version text NOT NULL,
  checklist_snapshot jsonb NOT NULL,
  org_name_snapshot text,
  consent_text_snapshot text NOT NULL,
  health_text_snapshot text,
  privacy_text_snapshot text,
  consent_version integer,
  response text NOT NULL CHECK (response IN ('none_apply','items_flagged')),
  none_apply boolean NOT NULL,
  flagged_items text[] NOT NULL DEFAULT '{}',
  blocking_items text[] NOT NULL DEFAULT '{}',
  cleared_items jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('cleared','blocked')),
  decline_reason text,
  practitioner_notes text,
  client_signature text NOT NULL,
  client_signed_at timestamp with time zone NOT NULL DEFAULT now(),
  practitioner_signature text NOT NULL,
  practitioner_signed_at timestamp with time zone NOT NULL DEFAULT now(),
  is_reattestation boolean NOT NULL DEFAULT false,
  prior_screening_id uuid REFERENCES public.client_screenings(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.client_screenings
  ADD CONSTRAINT client_screenings_response_consistent
  CHECK (
    (response = 'none_apply' AND none_apply = true AND cardinality(flagged_items) = 0)
    OR (response = 'items_flagged' AND none_apply = false AND cardinality(flagged_items) > 0)
  );

CREATE INDEX idx_client_screenings_client ON public.client_screenings(client_id, created_at DESC);
CREATE INDEX idx_client_screenings_org ON public.client_screenings(org_id, created_at DESC);

GRANT SELECT, INSERT ON public.client_screenings TO authenticated;
GRANT ALL ON public.client_screenings TO service_role;
ALTER TABLE public.client_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "screenings_select_own_org" ON public.client_screenings
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "screenings_insert_own_org" ON public.client_screenings
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND practitioner_id = auth.uid());

-- ============ Doctor's clearance letters (append-only) ============
CREATE TABLE public.client_clearance_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  issuer_name text NOT NULL,
  issued_on date,
  file_path text,
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clearance_letter_item_clearable CHECK (item_key <> 'pregnancy')
);
CREATE INDEX idx_clearance_letters_client ON public.client_clearance_letters(client_id, item_key);

GRANT SELECT, INSERT ON public.client_clearance_letters TO authenticated;
GRANT ALL ON public.client_clearance_letters TO service_role;
ALTER TABLE public.client_clearance_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "letters_select_own_org" ON public.client_clearance_letters
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "letters_insert_own_org" ON public.client_clearance_letters
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND recorded_by = auth.uid());

-- ============ Letter revocations (append-only, reason required) ============
CREATE TABLE public.client_clearance_letter_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.client_clearance_letters(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  revoked_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (letter_id)
);
GRANT SELECT, INSERT ON public.client_clearance_letter_revocations TO authenticated;
GRANT ALL ON public.client_clearance_letter_revocations TO service_role;
ALTER TABLE public.client_clearance_letter_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revocations_select_own_org" ON public.client_clearance_letter_revocations
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "revocations_insert_own_org" ON public.client_clearance_letter_revocations
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND revoked_by = auth.uid());

-- ============ Session link ============
ALTER TABLE public.sessions
  ADD COLUMN screening_id uuid REFERENCES public.client_screenings(id),
  ADD COLUMN decline_reason text;
CREATE INDEX idx_sessions_screening ON public.sessions(screening_id);

-- ============ Helper: is an item currently cleared for a client? ============
CREATE OR REPLACE FUNCTION public.client_item_cleared(_client_id uuid, _item text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN _item = 'pregnancy' THEN false ELSE EXISTS (
    SELECT 1 FROM public.client_clearance_letters l
    LEFT JOIN public.client_clearance_letter_revocations r ON r.letter_id = l.id
    WHERE l.client_id = _client_id AND l.item_key = _item AND r.id IS NULL
  ) END;
$$;

-- ============ Hard gate: sessions ============
CREATE OR REPLACE FUNCTION public.sessions_require_signed_screening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.client_screenings%ROWTYPE;
BEGIN
  IF NEW.screening_id IS NULL THEN
    RAISE EXCEPTION 'screening_required'
      USING HINT = 'A signed, countersigned screening must be recorded before a session exists.';
  END IF;

  SELECT * INTO s FROM public.client_screenings WHERE id = NEW.screening_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'screening_not_found';
  END IF;
  IF s.client_id IS DISTINCT FROM NEW.client_id OR s.org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'screening_mismatch'
      USING HINT = 'The screening does not belong to this client and clinic.';
  END IF;

  -- A cancelled session is the auditable record of a refusal; it may carry a
  -- blocked screening. Any other status requires a cleared screening.
  IF NEW.status <> 'cancelled' THEN
    IF s.outcome <> 'cleared' THEN
      RAISE EXCEPTION 'screening_blocked'
        USING HINT = 'This screening flagged a contraindication without valid clearance.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.sessions x
      WHERE x.screening_id = NEW.screening_id
        AND x.id <> NEW.id
        AND x.status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'screening_already_used'
        USING HINT = 'This screening has already authorised another session.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sessions_require_signed_screening
BEFORE INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_require_signed_screening();

CREATE OR REPLACE FUNCTION public.sessions_screening_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.screening_id IS DISTINCT FROM OLD.screening_id THEN
    RAISE EXCEPTION 'screening_link_immutable';
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'session_client_immutable';
  END IF;
  -- Re-validate on any transition away from cancelled or into a live status.
  IF NEW.status <> 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.client_screenings s
      WHERE s.id = NEW.screening_id AND s.outcome = 'cleared'
    ) THEN
      RAISE EXCEPTION 'screening_blocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sessions_screening_immutable
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_screening_immutable();

-- ============ Hard gate: bookings going live ============
CREATE OR REPLACE FUNCTION public.bookings_require_signed_screening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('in_progress','completed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.session_id IS NULL THEN
      RAISE EXCEPTION 'screening_required'
        USING HINT = 'Start the session through the screening flow before marking it in progress or complete.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions se
      JOIN public.client_screenings s ON s.id = se.screening_id
      WHERE se.id = NEW.session_id
        AND se.client_id = NEW.client_id
        AND s.outcome = 'cleared'
    ) THEN
      RAISE EXCEPTION 'screening_required'
        USING HINT = 'This booking has no cleared, signed screening on file.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bookings_require_signed_screening
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bookings_require_signed_screening();