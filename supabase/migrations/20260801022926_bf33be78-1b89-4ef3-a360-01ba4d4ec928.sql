ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS show_price boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_public_services(text);

CREATE OR REPLACE FUNCTION public.get_public_services(p_slug text)
RETURNS TABLE(id uuid, name text, duration_minutes integer, price numeric, show_price boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.duration_minutes,
         CASE WHEN s.show_price THEN s.price ELSE NULL END AS price,
         s.show_price
  FROM public.services s
  JOIN public.organisations o ON o.id = s.org_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND s.is_active = true
  ORDER BY s.name
$$;

GRANT EXECUTE ON FUNCTION public.get_public_services(text) TO anon, authenticated;