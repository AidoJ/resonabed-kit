ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS public_strapline text;

DROP FUNCTION IF EXISTS public.get_public_org(text);

CREATE OR REPLACE FUNCTION public.get_public_org(p_slug text)
 RETURNS TABLE(name text, logo_url text, brand_color text, slug text, public_blurb text, public_strapline text, public_contact_email text, public_contact_phone text, public_booking_enabled boolean, timezone text, theme_sidebar text, theme_primary text, public_suburb text, clinic_type text, public_address text)
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
         END AS public_address
  FROM public.organisations o
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
  LIMIT 1;
$function$;