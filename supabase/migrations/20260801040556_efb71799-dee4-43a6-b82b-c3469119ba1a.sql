ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Give existing rows a stable initial order based on current alphabetical listing
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY name) AS rn
  FROM public.services
)
UPDATE public.services s
SET sort_order = ranked.rn
FROM ranked
WHERE ranked.id = s.id AND s.sort_order = 0;

CREATE OR REPLACE FUNCTION public.get_public_services(p_slug text)
 RETURNS TABLE(id uuid, name text, duration_minutes integer, price numeric, show_price boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.duration_minutes,
         CASE WHEN s.show_price THEN s.price ELSE NULL END AS price,
         s.show_price
  FROM public.services s
  JOIN public.organisations o ON o.id = s.org_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND s.is_active = true
  ORDER BY s.sort_order, s.name
$function$;