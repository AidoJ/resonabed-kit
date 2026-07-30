ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS public_suburb text;

DROP FUNCTION IF EXISTS public.get_public_org(text);

CREATE FUNCTION public.get_public_org(p_slug text)
 RETURNS TABLE(name text, logo_url text, brand_color text, slug text, public_blurb text, public_contact_email text, public_contact_phone text, public_booking_enabled boolean, timezone text, theme_sidebar text, theme_primary text, public_suburb text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT o.name, o.logo_url, o.brand_color, o.slug, o.public_blurb,
         o.public_contact_email, o.public_contact_phone, o.public_booking_enabled, o.timezone,
         o.theme_sidebar, o.theme_primary, o.public_suburb
  FROM public.organisations o
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
  LIMIT 1;
$function$;