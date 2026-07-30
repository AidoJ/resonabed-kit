-- 1. Private operational address + clinic type
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS clinic_type text NOT NULL DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS clinic_type_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retail_show_address boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_postcode text,
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'Australia';

ALTER TABLE public.organisations
  DROP CONSTRAINT IF EXISTS organisations_clinic_type_check;
ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_clinic_type_check
  CHECK (clinic_type IN ('retail','home'));

COMMENT ON COLUMN public.organisations.clinic_type IS
  'retail = street address may be shown publicly; home = street address is NEVER public, released only in the client confirmation email after the operator confirms a booking.';

-- 2. Publishing gate: the operator must have consciously chosen a clinic type.
CREATE OR REPLACE FUNCTION public.organisations_check_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.published THEN
    IF NEW.slug IS NULL THEN
      RAISE EXCEPTION 'A public URL name (slug) is required before publishing.';
    END IF;
    IF NOT COALESCE(NEW.is_configured, false) THEN
      RAISE EXCEPTION 'Organisation setup must be completed and acknowledged before publishing.';
    END IF;
    IF NOT COALESCE(NEW.clinic_type_confirmed, false) THEN
      RAISE EXCEPTION 'Choose whether this clinic is retail/commercial or home-based before publishing.';
    END IF;
  ELSE
    NEW.public_booking_enabled := false;
  END IF;

  -- Home-based clinics can never expose a street address publicly.
  IF NEW.clinic_type = 'home' THEN
    NEW.retail_show_address := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS organisations_check_publish_trg ON public.organisations;
CREATE TRIGGER organisations_check_publish_trg
  BEFORE INSERT OR UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.organisations_check_publish();

-- 3. Public read: never returns a street address for home-based orgs.
DROP FUNCTION IF EXISTS public.get_public_org(text);
CREATE OR REPLACE FUNCTION public.get_public_org(p_slug text)
 RETURNS TABLE(name text, logo_url text, brand_color text, slug text, public_blurb text,
               public_contact_email text, public_contact_phone text, public_booking_enabled boolean,
               timezone text, theme_sidebar text, theme_primary text, public_suburb text,
               clinic_type text, public_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT o.name, o.logo_url, o.brand_color, o.slug, o.public_blurb,
         o.public_contact_email, o.public_contact_phone, o.public_booking_enabled, o.timezone,
         o.theme_sidebar, o.theme_primary, o.public_suburb,
         o.clinic_type,
         CASE
           WHEN o.clinic_type = 'retail' AND o.retail_show_address
             THEN nullif(trim(both ' ' from concat_ws(', ',
                    nullif(o.address_line1,''), nullif(o.address_line2,''),
                    nullif(o.address_city,''),
                    nullif(trim(concat_ws(' ', nullif(o.address_state,''), nullif(o.address_postcode,''))),''))), '')
           ELSE NULL
         END AS public_address
  FROM public.organisations o
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_org(text) TO anon, authenticated;