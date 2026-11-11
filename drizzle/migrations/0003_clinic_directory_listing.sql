ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS directory_listed boolean NOT NULL DEFAULT false;

-- Public directory entries: only published, active clinics that opted in.
-- Exposes the clinic name, page slug, suburb, state and postcode, plus the
-- phone only when the clinic already shows it on its public page.
CREATE OR REPLACE FUNCTION public.get_public_directory(p_slug text DEFAULT NULL)
RETURNS TABLE(
  slug text,
  name text,
  suburb text,
  state text,
  postcode text,
  telephone text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT o.slug,
         o.name,
         nullif(trim(o.address_city), '') AS suburb,
         nullif(upper(trim(o.address_state)), '') AS state,
         nullif(trim(o.address_postcode), '') AS postcode,
         CASE WHEN o.public_show_phone THEN nullif(trim(o.public_contact_phone), '') ELSE NULL END AS telephone,
         o.updated_at
  FROM public.organisations o
  WHERE o.directory_listed = true
    AND o.published = true
    AND o.status = 'active'
    AND o.slug IS NOT NULL
    AND (p_slug IS NULL OR o.slug = p_slug)
  ORDER BY o.slug
$$;

REVOKE ALL ON FUNCTION public.get_public_directory(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_directory(text) TO anon, authenticated, service_role;