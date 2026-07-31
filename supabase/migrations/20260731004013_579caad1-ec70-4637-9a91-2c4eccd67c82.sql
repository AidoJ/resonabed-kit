DROP POLICY IF EXISTS clearance_letters_select ON storage.objects;
CREATE POLICY clearance_letters_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'clearance-letters'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_org_id()::text
  )
);

DROP POLICY IF EXISTS clearance_letters_insert ON storage.objects;
CREATE POLICY clearance_letters_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clearance-letters'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);