-- Normalised phone key for matching (immutable so it can back a generated column)
CREATE OR REPLACE FUNCTION public.normalise_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _phone IS NULL THEN NULL
    ELSE nullif(
      CASE
        WHEN length(regexp_replace(_phone, '\D', '', 'g')) >= 9
          THEN right(regexp_replace(_phone, '\D', '', 'g'), 9)
        ELSE regexp_replace(_phone, '\D', '', 'g')
      END, '')
  END
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_normalised text
  GENERATED ALWAYS AS (public.normalise_phone(phone)) STORED;

CREATE INDEX IF NOT EXISTS clients_org_phone_norm_idx ON public.clients (org_id, phone_normalised);
CREATE INDEX IF NOT EXISTS clients_org_email_lower_idx ON public.clients (org_id, lower(email));

-- ---------------------------------------------------------------- audit log
CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  booking_id uuid,
  client_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'request_received','viewed','confirmed','declined','cancelled','blocked_attempt','blocked','unblocked'
  )),
  reason_code text,
  actor_user_id uuid,
  actor_name text,
  requester_name text,
  requester_email text,
  requester_phone text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_events_select ON public.booking_events
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY booking_events_insert ON public.booking_events
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE INDEX booking_events_org_created_idx ON public.booking_events (org_id, created_at DESC);
CREATE INDEX booking_events_booking_idx ON public.booking_events (booking_id, created_at DESC);

-- --------------------------------------------------------------- block list
CREATE TABLE public.blocked_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text,
  phone text,
  phone_normalised text GENERATED ALWAYS AS (public.normalise_phone(phone)) STORED,
  display_name text,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_contacts_needs_identifier CHECK (
    coalesce(nullif(trim(email), ''), nullif(trim(phone), '')) IS NOT NULL
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_contacts TO authenticated;
GRANT ALL ON public.blocked_contacts TO service_role;
ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_contacts_select ON public.blocked_contacts
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY blocked_contacts_insert ON public.blocked_contacts
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY blocked_contacts_update ON public.blocked_contacts
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR org_id = current_org_id())
  WITH CHECK (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY blocked_contacts_delete ON public.blocked_contacts
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR (org_id = current_org_id() AND is_org_admin(auth.uid(), org_id)));

CREATE INDEX blocked_contacts_org_phone_idx ON public.blocked_contacts (org_id, phone_normalised);
CREATE INDEX blocked_contacts_org_email_idx ON public.blocked_contacts (org_id, lower(email));

CREATE TRIGGER blocked_contacts_set_updated_at
  BEFORE UPDATE ON public.blocked_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------- protected client notes
CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  kind text NOT NULL DEFAULT 'general' CHECK (kind IN ('general','vetting_call')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_notes_select ON public.client_notes
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY client_notes_insert ON public.client_notes
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR org_id = current_org_id());

CREATE POLICY client_notes_update ON public.client_notes
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR (org_id = current_org_id() AND author_id = auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR (org_id = current_org_id() AND author_id = auth.uid()));

CREATE POLICY client_notes_delete ON public.client_notes
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR (org_id = current_org_id() AND is_org_admin(auth.uid(), org_id)));

CREATE INDEX client_notes_client_idx ON public.client_notes (client_id, created_at DESC);

CREATE TRIGGER client_notes_set_updated_at
  BEFORE UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();