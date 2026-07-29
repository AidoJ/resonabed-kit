CREATE OR REPLACE FUNCTION public.get_public_services(p_slug text)
RETURNS TABLE(id uuid, name text, duration_minutes integer, price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.duration_minutes, s.price
  FROM public.services s
  JOIN public.organisations o ON o.id = s.org_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND s.is_active = true
  ORDER BY s.name
$$;

GRANT EXECUTE ON FUNCTION public.get_public_services(text) TO anon, authenticated;