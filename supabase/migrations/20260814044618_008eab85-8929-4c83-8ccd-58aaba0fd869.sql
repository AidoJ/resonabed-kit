
-- 1. Order-level arrears / dunning tracking
ALTER TABLE public.kit_orders
  ADD COLUMN IF NOT EXISTS first_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prior_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_stage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dunning_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS arrears_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS defaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS wind_down_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS access_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS owed_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS write_off_cents integer,
  ADD COLUMN IF NOT EXISTS written_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_expiry_warned_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.kit_orders
    ADD CONSTRAINT kit_orders_access_level_chk
    CHECK (access_level = ANY (ARRAY['full'::text,'limited'::text,'suspended'::text]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS kit_orders_arrears_idx
  ON public.kit_orders (state) WHERE arrears_since IS NOT NULL;

-- 2. Home access codes carry the access level for the personal app
ALTER TABLE public.kit_access_codes
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'full';

DO $$ BEGIN
  ALTER TABLE public.kit_access_codes
    ADD CONSTRAINT kit_access_codes_access_level_chk
    CHECK (access_level = ANY (ARRAY['full'::text,'limited'::text,'suspended'::text]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Organisations carry the clinic-side plan access level
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS plan_access_level text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS suspended_by_order_id uuid;

DO $$ BEGIN
  ALTER TABLE public.organisations
    ADD CONSTRAINT organisations_plan_access_level_chk
    CHECK (plan_access_level = ANY (ARRAY['full'::text,'limited'::text,'suspended'::text]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Access lookups
CREATE OR REPLACE FUNCTION public.home_plan_access_level(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT c.access_level
       FROM public.home_accounts h
       JOIN public.kit_access_codes c ON c.id = h.access_code_id
      WHERE h.user_id = _user_id),
    'full');
$$;

CREATE OR REPLACE FUNCTION public.org_plan_access_ok(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT plan_access_level = 'full' AND status = 'active'
       FROM public.organisations WHERE id = _org_id),
    true);
$$;

-- 5. New sessions and new bookings pause while a plan order is in default.
--    Client records, screenings and clearance letters are never touched.
CREATE OR REPLACE FUNCTION public.require_plan_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.org_plan_access_ok(NEW.org_id) THEN
    RAISE EXCEPTION 'plan_access_paused'
      USING HINT = 'This account is paused pending an overdue payment plan instalment. Existing records stay available.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_require_plan_access ON public.sessions;
CREATE TRIGGER sessions_require_plan_access
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.require_plan_access();

DROP TRIGGER IF EXISTS bookings_require_plan_access ON public.bookings;
CREATE TRIGGER bookings_require_plan_access
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.require_plan_access();

-- 6. Public clinic pages go quiet while paused
CREATE OR REPLACE FUNCTION public.get_public_org(p_slug text)
 RETURNS TABLE(name text, logo_url text, brand_color text, slug text, public_blurb text, public_strapline text, public_contact_email text, public_contact_phone text, public_booking_enabled boolean, timezone text, theme_sidebar text, theme_primary text, public_suburb text, clinic_type text, public_address text, public_show_practitioners boolean, public_allow_practitioner_choice boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT o.name, o.logo_url, o.brand_color, o.slug, o.public_blurb,
         o.public_strapline,
         CASE WHEN o.public_show_email THEN o.public_contact_email ELSE NULL END AS public_contact_email,
         CASE WHEN o.public_show_phone THEN o.public_contact_phone ELSE NULL END AS public_contact_phone,
         (o.public_booking_enabled AND o.plan_access_level = 'full') AS public_booking_enabled,
         o.timezone,
         o.theme_sidebar, o.theme_primary, o.public_suburb,
         o.clinic_type,
         CASE
           WHEN o.clinic_type = 'retail' AND o.retail_show_address
             THEN nullif(trim(both ' ' from concat_ws(', ',
                    nullif(o.address_line1,''), nullif(o.address_line2,''),
                    nullif(o.address_city,''),
                    nullif(trim(concat_ws(' ', nullif(o.address_state,''), nullif(o.address_postcode,''))),''))), '')
           ELSE NULL
         END AS public_address,
         o.public_show_practitioners,
         o.public_allow_practitioner_choice
  FROM public.organisations o
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_availability(p_slug text)
 RETURNS TABLE(day_of_week integer, start_time time without time zone, end_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT a.day_of_week, min(a.start_time) AS start_time, max(a.end_time) AS end_time
  FROM public.practitioner_availability a
  JOIN public.organisations o ON o.id = a.org_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND o.plan_access_level = 'full'
    AND o.public_booking_enabled = true
    AND a.is_active = true
    AND p.is_active = true
  GROUP BY a.day_of_week
  ORDER BY a.day_of_week
$function$;

CREATE OR REPLACE FUNCTION public.get_public_practitioner_availability(p_slug text)
 RETURNS TABLE(practitioner_id uuid, day_of_week integer, start_time time without time zone, end_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT a.practitioner_id, a.day_of_week, a.start_time, a.end_time
  FROM public.practitioner_availability a
  JOIN public.organisations o ON o.id = a.org_id
  JOIN public.profiles p ON p.id = a.practitioner_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND o.plan_access_level = 'full'
    AND o.public_booking_enabled = true
    AND o.public_allow_practitioner_choice = true
    AND a.is_active = true
    AND p.is_active = true
  ORDER BY a.practitioner_id, a.day_of_week, a.start_time
$function$;
