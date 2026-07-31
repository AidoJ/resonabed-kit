-- 1. Audit trail: new event types -------------------------------------------
ALTER TABLE public.booking_events DROP CONSTRAINT IF EXISTS booking_events_event_type_check;
ALTER TABLE public.booking_events ADD CONSTRAINT booking_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'request_received','viewed','confirmed','declined','cancelled',
    'blocked_attempt','blocked','unblocked','note_added',
    'alternates_offered','alternates_reminded','alternates_accepted',
    'alternates_expired','alternates_withdrawn','re_requested'
  ]));

-- 2. Offers -------------------------------------------------------------------
CREATE TABLE public.booking_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  -- SHA-256 of the single-use token. The raw token is never stored.
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','expired','withdrawn')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  reminded_at timestamptz,
  accepted_at timestamptz,
  accepted_slot_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_offer_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.booking_offers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_offers_booking_idx ON public.booking_offers(booking_id);
CREATE INDEX booking_offers_open_idx ON public.booking_offers(status, expires_at);
CREATE INDEX booking_offer_slots_offer_idx ON public.booking_offer_slots(offer_id);

GRANT SELECT, INSERT, UPDATE ON public.booking_offers TO authenticated;
GRANT ALL ON public.booking_offers TO service_role;
GRANT SELECT, INSERT, DELETE ON public.booking_offer_slots TO authenticated;
GRANT ALL ON public.booking_offer_slots TO service_role;

ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_offer_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read offers in their org" ON public.booking_offers
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Staff create offers in their org" ON public.booking_offers
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Staff update offers in their org" ON public.booking_offers
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "Staff read offer slots in their org" ON public.booking_offer_slots
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Staff create offer slots in their org" ON public.booking_offer_slots
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Staff delete offer slots in their org" ON public.booking_offer_slots
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

CREATE TRIGGER booking_offers_set_updated_at
  BEFORE UPDATE ON public.booking_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Double-book guard: first-to-confirm wins at the database level ----------
CREATE UNIQUE INDEX IF NOT EXISTS bookings_confirmed_slot_uniq
  ON public.bookings (practitioner_id, starts_at)
  WHERE practitioner_id IS NOT NULL
    AND status IN ('confirmed','in_progress','completed');

-- 4. Public working-hours pattern (merged, no therapist identity) ------------
CREATE OR REPLACE FUNCTION public.get_public_availability(p_slug text)
RETURNS TABLE(day_of_week integer, start_time time, end_time time)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT a.day_of_week, min(a.start_time) AS start_time, max(a.end_time) AS end_time
  FROM public.practitioner_availability a
  JOIN public.organisations o ON o.id = a.org_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND o.public_booking_enabled = true
    AND a.is_active = true
    AND p.is_active = true
  GROUP BY a.day_of_week
  ORDER BY a.day_of_week
$$;

GRANT EXECUTE ON FUNCTION public.get_public_availability(text) TO anon, authenticated;