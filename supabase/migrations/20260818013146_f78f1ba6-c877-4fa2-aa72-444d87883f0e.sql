ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_path text;

DROP POLICY IF EXISTS service_images_read ON storage.objects;
CREATE POLICY service_images_read ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'service-images');

DROP POLICY IF EXISTS service_images_write ON storage.objects;
CREATE POLICY service_images_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-images'
  AND (
    (public.is_super_admin(auth.uid()) AND (storage.foldername(name))[1] = 'global')
    OR ((storage.foldername(name))[1] <> 'global'
        AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
  )
);

DROP POLICY IF EXISTS service_images_update ON storage.objects;
CREATE POLICY service_images_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'service-images'
  AND (
    (public.is_super_admin(auth.uid()) AND (storage.foldername(name))[1] = 'global')
    OR ((storage.foldername(name))[1] <> 'global'
        AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
  )
);

DROP POLICY IF EXISTS service_images_delete ON storage.objects;
CREATE POLICY service_images_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'service-images'
  AND (
    (public.is_super_admin(auth.uid()) AND (storage.foldername(name))[1] = 'global')
    OR ((storage.foldername(name))[1] <> 'global'
        AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
  )
);

DROP FUNCTION IF EXISTS public.get_public_services(text);
CREATE OR REPLACE FUNCTION public.get_public_services(p_slug text)
RETURNS TABLE(id uuid, name text, duration_minutes integer, price numeric, show_price boolean, description text, image_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.duration_minutes,
         CASE WHEN s.show_price THEN s.price ELSE NULL END AS price,
         s.show_price,
         COALESCE(g.description, s.description) AS description,
         COALESCE(g.image_path, s.image_path) AS image_path
  FROM public.services s
  LEFT JOIN public.services g ON g.id = s.source_global_id AND g.org_id IS NULL
  JOIN public.organisations o ON o.id = s.org_id
  WHERE o.slug = p_slug
    AND o.published = true
    AND o.status = 'active'
    AND s.is_active = true
  ORDER BY s.sort_order, s.name
$$;

GRANT EXECUTE ON FUNCTION public.get_public_services(text) TO anon, authenticated;