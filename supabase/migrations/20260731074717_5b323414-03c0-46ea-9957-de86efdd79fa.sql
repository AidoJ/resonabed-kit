-- =============================================================
-- PART 1: cross-clinic scoping tightening
-- =============================================================

-- Super admin health access requires BOTH an open support session for that org
-- AND a live (unrevoked, unexpired) support grant from that org.
CREATE OR REPLACE FUNCTION public.super_admin_supporting_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_sessions ss
    JOIN public.support_access_grants g ON g.id = ss.grant_id
    WHERE ss.super_admin_id = _user_id
      AND ss.org_id = _org_id
      AND ss.exited_at IS NULL
      AND g.org_id = _org_id
      AND g.revoked_at IS NULL
      AND g.expires_at > now()
  ) AND public.is_super_admin(_user_id);
$$;

DROP POLICY IF EXISTS screenings_select_own_org ON public.client_screenings;
CREATE POLICY screenings_select_own_org ON public.client_screenings
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS letters_select_own_org ON public.client_clearance_letters;
CREATE POLICY letters_select_own_org ON public.client_clearance_letters
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS revocations_select_own_org ON public.client_clearance_letter_revocations;
CREATE POLICY revocations_select_own_org ON public.client_clearance_letter_revocations
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS client_notes_select ON public.client_notes;
CREATE POLICY client_notes_select ON public.client_notes
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS client_notes_insert ON public.client_notes;
CREATE POLICY client_notes_insert ON public.client_notes
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS client_notes_update ON public.client_notes;
CREATE POLICY client_notes_update ON public.client_notes
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (author_id = auth.uid() OR public.is_org_admin(auth.uid(), org_id)))
  WITH CHECK (org_id = public.current_org_id() AND (author_id = auth.uid() OR public.is_org_admin(auth.uid(), org_id)));

DROP POLICY IF EXISTS client_notes_delete ON public.client_notes;
CREATE POLICY client_notes_delete ON public.client_notes
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin(auth.uid(), org_id));

-- sessions: health-bearing. Same rule.
DROP POLICY IF EXISTS sessions_select ON public.sessions;
CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS sessions_insert ON public.sessions;
CREATE POLICY sessions_insert ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS sessions_update ON public.sessions;
CREATE POLICY sessions_update ON public.sessions
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id))
  WITH CHECK (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS sessions_delete_admin_only ON public.sessions;
CREATE POLICY sessions_delete_admin_only ON public.sessions
  FOR DELETE TO authenticated
  USING (
    (org_id = public.current_org_id() AND public.is_org_admin(auth.uid(), org_id))
    OR public.super_admin_supporting_org(auth.uid(), org_id)
  );

-- Counts-only platform aggregates. Never returns health row contents.
CREATE OR REPLACE FUNCTION public.platform_org_session_metrics(_since timestamptz)
RETURNS TABLE(org_id uuid, sessions_30d bigint, sessions_total bigint, revenue_total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.org_id,
         count(*) FILTER (WHERE s.created_at >= _since)          AS sessions_30d,
         count(*)                                                AS sessions_total,
         coalesce(sum(s.payment_amount) FILTER (WHERE s.status = 'completed'), 0) AS revenue_total
  FROM public.sessions s
  WHERE public.is_super_admin(auth.uid())
  GROUP BY s.org_id;
$$;

REVOKE ALL ON FUNCTION public.platform_org_session_metrics(timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_org_session_metrics(timestamptz) TO authenticated, service_role;

-- =============================================================
-- PART 2: pseudonym tokens
-- =============================================================

CREATE TABLE IF NOT EXISTS public.client_pseudonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT ('RB-' || upper(encode(gen_random_bytes(4), 'hex'))),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_pseudonyms TO authenticated;
GRANT ALL ON public.client_pseudonyms TO service_role;
ALTER TABLE public.client_pseudonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pseudonyms_select ON public.client_pseudonyms;
CREATE POLICY pseudonyms_select ON public.client_pseudonyms
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

DROP POLICY IF EXISTS pseudonyms_insert ON public.client_pseudonyms;
CREATE POLICY pseudonyms_insert ON public.client_pseudonyms
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() OR public.super_admin_supporting_org(auth.uid(), org_id));

-- Identity references the token (never the reverse).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS pseudonym_id uuid REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS clients_pseudonym_id_key ON public.clients(pseudonym_id);

ALTER TABLE public.sessions                            ADD COLUMN IF NOT EXISTS pseudonym_id uuid;
ALTER TABLE public.client_screenings                   ADD COLUMN IF NOT EXISTS pseudonym_id uuid;
ALTER TABLE public.client_notes                        ADD COLUMN IF NOT EXISTS pseudonym_id uuid;
ALTER TABLE public.client_clearance_letters            ADD COLUMN IF NOT EXISTS pseudonym_id uuid;
ALTER TABLE public.client_clearance_letter_revocations ADD COLUMN IF NOT EXISTS pseudonym_id uuid;

-- ---------------- idempotent backfill + hard assertions ----------------
DO $mig$
DECLARE
  c_before_clients bigint;
  c_before_sessions bigint;
  c_before_screenings bigint;
  c_before_notes bigint;
  c_before_letters bigint;
  c_before_revocs bigint;
  bad bigint;
BEGIN
  SELECT count(*) INTO c_before_clients   FROM public.clients;
  SELECT count(*) INTO c_before_sessions  FROM public.sessions;
  SELECT count(*) INTO c_before_screenings FROM public.client_screenings;
  SELECT count(*) INTO c_before_notes     FROM public.client_notes;
  SELECT count(*) INTO c_before_letters   FROM public.client_clearance_letters;
  SELECT count(*) INTO c_before_revocs    FROM public.client_clearance_letter_revocations;

  -- one token per client, exactly once (re-run inserts nothing)
  WITH missing AS (
    SELECT id, org_id FROM public.clients WHERE pseudonym_id IS NULL
  ), created AS (
    INSERT INTO public.client_pseudonyms (org_id)
    SELECT org_id FROM missing
    RETURNING id AS pseudonym_id, org_id
  ), paired AS (
    SELECT m.id AS client_id, c.pseudonym_id
    FROM (SELECT id, org_id, row_number() OVER (PARTITION BY org_id ORDER BY id) rn FROM missing) m
    JOIN (SELECT pseudonym_id, org_id, row_number() OVER (PARTITION BY org_id ORDER BY pseudonym_id) rn FROM created) c
      ON c.org_id = m.org_id AND c.rn = m.rn
  )
  UPDATE public.clients cl SET pseudonym_id = p.pseudonym_id
  FROM paired p WHERE cl.id = p.client_id;

  -- backfill health rows from the existing client_id join
  UPDATE public.sessions t SET pseudonym_id = c.pseudonym_id
    FROM public.clients c WHERE c.id = t.client_id AND t.pseudonym_id IS NULL;
  UPDATE public.client_screenings t SET pseudonym_id = c.pseudonym_id
    FROM public.clients c WHERE c.id = t.client_id AND t.pseudonym_id IS NULL;
  UPDATE public.client_notes t SET pseudonym_id = c.pseudonym_id
    FROM public.clients c WHERE c.id = t.client_id AND t.pseudonym_id IS NULL;
  UPDATE public.client_clearance_letters t SET pseudonym_id = c.pseudonym_id
    FROM public.clients c WHERE c.id = t.client_id AND t.pseudonym_id IS NULL;
  UPDATE public.client_clearance_letter_revocations t SET pseudonym_id = l.pseudonym_id
    FROM public.client_clearance_letters l WHERE l.id = t.letter_id AND t.pseudonym_id IS NULL;

  -- (a) every client has exactly one token, tokens are unique
  SELECT count(*) INTO bad FROM public.clients WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % clients without a pseudonym', bad; END IF;
  SELECT count(*) INTO bad FROM (
    SELECT pseudonym_id FROM public.clients GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % pseudonyms shared by multiple clients', bad; END IF;

  -- (b) no null tokens in any health table
  SELECT count(*) INTO bad FROM public.sessions WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % sessions with null pseudonym_id', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_screenings WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % screenings with null pseudonym_id', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_notes WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % notes with null pseudonym_id', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_clearance_letters WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % letters with null pseudonym_id', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_clearance_letter_revocations WHERE pseudonym_id IS NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % revocations with null pseudonym_id', bad; END IF;

  -- (c) every health row's token resolves back to the SAME client it came from
  SELECT count(*) INTO bad FROM public.sessions t
    LEFT JOIN public.clients c ON c.pseudonym_id = t.pseudonym_id
    WHERE c.id IS DISTINCT FROM t.client_id;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % sessions resolve to the wrong client', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_screenings t
    LEFT JOIN public.clients c ON c.pseudonym_id = t.pseudonym_id
    WHERE c.id IS DISTINCT FROM t.client_id;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % screenings resolve to the wrong client', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_notes t
    LEFT JOIN public.clients c ON c.pseudonym_id = t.pseudonym_id
    WHERE c.id IS DISTINCT FROM t.client_id;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % notes resolve to the wrong client', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_clearance_letters t
    LEFT JOIN public.clients c ON c.pseudonym_id = t.pseudonym_id
    WHERE c.id IS DISTINCT FROM t.client_id;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % letters resolve to the wrong client', bad; END IF;
  SELECT count(*) INTO bad FROM public.client_clearance_letter_revocations t
    JOIN public.client_clearance_letters l ON l.id = t.letter_id
    WHERE l.pseudonym_id IS DISTINCT FROM t.pseudonym_id;
  IF bad > 0 THEN RAISE EXCEPTION 'assert failed: % revocations disagree with their letter', bad; END IF;

  -- (d) nothing was created or destroyed
  IF (SELECT count(*) FROM public.clients) <> c_before_clients
     OR (SELECT count(*) FROM public.sessions) <> c_before_sessions
     OR (SELECT count(*) FROM public.client_screenings) <> c_before_screenings
     OR (SELECT count(*) FROM public.client_notes) <> c_before_notes
     OR (SELECT count(*) FROM public.client_clearance_letters) <> c_before_letters
     OR (SELECT count(*) FROM public.client_clearance_letter_revocations) <> c_before_revocs
  THEN RAISE EXCEPTION 'assert failed: row counts changed during backfill'; END IF;

  RAISE NOTICE 'pseudonym backfill verified: % clients, % sessions, % screenings, % notes, % letters, % revocations',
    c_before_clients, c_before_sessions, c_before_screenings, c_before_notes, c_before_letters, c_before_revocs;
END
$mig$;

-- only after verification
ALTER TABLE public.sessions                            ALTER COLUMN pseudonym_id SET NOT NULL;
ALTER TABLE public.client_screenings                   ALTER COLUMN pseudonym_id SET NOT NULL;
ALTER TABLE public.client_notes                        ALTER COLUMN pseudonym_id SET NOT NULL;
ALTER TABLE public.client_clearance_letters            ALTER COLUMN pseudonym_id SET NOT NULL;
ALTER TABLE public.client_clearance_letter_revocations ALTER COLUMN pseudonym_id SET NOT NULL;

ALTER TABLE public.clients ALTER COLUMN pseudonym_id SET NOT NULL;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_pseudonym_id_fkey') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_pseudonym_id_fkey
      FOREIGN KEY (pseudonym_id) REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_screenings_pseudonym_id_fkey') THEN
    ALTER TABLE public.client_screenings ADD CONSTRAINT client_screenings_pseudonym_id_fkey
      FOREIGN KEY (pseudonym_id) REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_pseudonym_id_fkey') THEN
    ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_pseudonym_id_fkey
      FOREIGN KEY (pseudonym_id) REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_clearance_letters_pseudonym_id_fkey') THEN
    ALTER TABLE public.client_clearance_letters ADD CONSTRAINT client_clearance_letters_pseudonym_id_fkey
      FOREIGN KEY (pseudonym_id) REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_clearance_letter_revocations_pseudonym_id_fkey') THEN
    ALTER TABLE public.client_clearance_letter_revocations ADD CONSTRAINT client_clearance_letter_revocations_pseudonym_id_fkey
      FOREIGN KEY (pseudonym_id) REFERENCES public.client_pseudonyms(id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

CREATE INDEX IF NOT EXISTS sessions_pseudonym_idx    ON public.sessions(pseudonym_id);
CREATE INDEX IF NOT EXISTS screenings_pseudonym_idx  ON public.client_screenings(pseudonym_id);
CREATE INDEX IF NOT EXISTS notes_pseudonym_idx       ON public.client_notes(pseudonym_id);
CREATE INDEX IF NOT EXISTS letters_pseudonym_idx     ON public.client_clearance_letters(pseudonym_id);

-- ---------------- dual-write: keep both keys in step ----------------

CREATE OR REPLACE FUNCTION public.clients_ensure_pseudonym()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pseudonym_id IS NULL THEN
    INSERT INTO public.client_pseudonyms (org_id) VALUES (NEW.org_id)
    RETURNING id INTO NEW.pseudonym_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_clients_ensure_pseudonym ON public.clients;
CREATE TRIGGER aa_clients_ensure_pseudonym
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_ensure_pseudonym();

-- Derives the token from client_id on write, so application code keeps working
-- during the dual-write soak. Named aa_* so it runs before the gate triggers.
CREATE OR REPLACE FUNCTION public.fill_pseudonym_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p uuid;
BEGIN
  IF NEW.pseudonym_id IS NULL THEN
    SELECT pseudonym_id INTO p FROM public.clients WHERE id = NEW.client_id;
    IF p IS NULL THEN
      RAISE EXCEPTION 'pseudonym_unresolved'
        USING HINT = 'This client has no pseudonym token; the health record was not written.';
    END IF;
    NEW.pseudonym_id := p;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_fill_pseudonym ON public.sessions;
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.fill_pseudonym_from_client();
DROP TRIGGER IF EXISTS aa_fill_pseudonym ON public.client_screenings;
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT ON public.client_screenings
  FOR EACH ROW EXECUTE FUNCTION public.fill_pseudonym_from_client();
DROP TRIGGER IF EXISTS aa_fill_pseudonym ON public.client_notes;
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT OR UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.fill_pseudonym_from_client();
DROP TRIGGER IF EXISTS aa_fill_pseudonym ON public.client_clearance_letters;
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT ON public.client_clearance_letters
  FOR EACH ROW EXECUTE FUNCTION public.fill_pseudonym_from_client();

CREATE OR REPLACE FUNCTION public.fill_pseudonym_from_letter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p uuid;
BEGIN
  IF NEW.pseudonym_id IS NULL THEN
    SELECT pseudonym_id INTO p FROM public.client_clearance_letters WHERE id = NEW.letter_id;
    IF p IS NULL THEN
      RAISE EXCEPTION 'pseudonym_unresolved';
    END IF;
    NEW.pseudonym_id := p;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_fill_pseudonym ON public.client_clearance_letter_revocations;
CREATE TRIGGER aa_fill_pseudonym BEFORE INSERT ON public.client_clearance_letter_revocations
  FOR EACH ROW EXECUTE FUNCTION public.fill_pseudonym_from_letter();

-- =============================================================
-- Screening gate, re-keyed onto the token
-- =============================================================

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
  IF s.pseudonym_id IS DISTINCT FROM NEW.pseudonym_id OR s.org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'screening_mismatch'
      USING HINT = 'The screening does not belong to this client and clinic.';
  END IF;

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
  IF NEW.pseudonym_id IS DISTINCT FROM OLD.pseudonym_id OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'session_client_immutable';
  END IF;
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

CREATE OR REPLACE FUNCTION public.bookings_require_signed_screening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pseudonym uuid;
BEGIN
  IF NEW.status IN ('in_progress','completed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.session_id IS NULL THEN
      RAISE EXCEPTION 'screening_required'
        USING HINT = 'Start the session through the screening flow before marking it in progress or complete.';
    END IF;
    SELECT pseudonym_id INTO v_pseudonym FROM public.clients WHERE id = NEW.client_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions se
      JOIN public.client_screenings s ON s.id = se.screening_id
      WHERE se.id = NEW.session_id
        AND se.pseudonym_id = v_pseudonym
        AND s.outcome = 'cleared'
    ) THEN
      RAISE EXCEPTION 'screening_required'
        USING HINT = 'This booking has no cleared, signed screening on file.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Token-keyed clearance lookup; still accepts a client id during the soak.
CREATE OR REPLACE FUNCTION public.client_item_cleared(_client_id uuid, _item text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN _item = 'pregnancy' THEN false ELSE EXISTS (
    SELECT 1 FROM public.client_clearance_letters l
    LEFT JOIN public.client_clearance_letter_revocations r ON r.letter_id = l.id
    WHERE l.item_key = _item
      AND r.id IS NULL
      AND (
        l.pseudonym_id = _client_id
        OR l.pseudonym_id = (SELECT pseudonym_id FROM public.clients WHERE id = _client_id)
      )
  ) END;
$$;

COMMENT ON TABLE public.booking_events IS
  'Booking audit trail. Identity-bearing BY DESIGN (requester name/email/phone). Not a health store; excluded from the pseudonymisation layer deliberately.';
COMMENT ON TABLE public.client_pseudonyms IS
  'Opaque, randomly generated client tokens. No derivation from any personal detail. Health records key on this; identity (public.clients) references it.';
