ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS public_show_practitioners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_allow_practitioner_choice boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_org(text);

CREATE FUNCTION public.get_public_org(p_slug text)
RETURNS TABLE(name text, logo_url text, brand_color text, slug text, public_blurb text, public_strapline text, public_contact_email text, public_contact_phone text, public_booking_enabled boolean, timezone text, theme_sidebar text, theme_primary text, public_suburb text, clinic_type text, public_address text, public_show_practitioners boolean, public_allow_practitioner_choice boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT o.name, o.logo_url, o.brand_color, o.slug, o.public_blurb,
         o.public_strapline,
         CASE WHEN o.public_show_email THEN o.public_contact_email ELSE NULL END AS public_contact_email,
         CASE WHEN o.public_show_phone THEN o.public_contact_phone ELSE NULL END AS public_contact_phone,
         o.public_booking_enabled, o.timezone,
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

GRANT EXECUTE ON FUNCTION public.get_public_org(text) TO anon, authenticated, service_role;

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
    AND o.public_booking_enabled = true
    AND o.public_allow_practitioner_choice = true
    AND a.is_active = true
    AND p.is_active = true
  ORDER BY a.practitioner_id, a.day_of_week, a.start_time
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_practitioner_availability(text) TO anon, authenticated, service_role;