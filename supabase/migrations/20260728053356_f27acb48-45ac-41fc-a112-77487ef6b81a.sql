DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id))
)
WITH CHECK (
  id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id))
);

-- Storage policies for team-avatars: path is {org_id}/{user_id}.{ext}
DROP POLICY IF EXISTS team_avatars_select ON storage.objects;
CREATE POLICY team_avatars_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'team-avatars'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_org_id()::text
  )
);

DROP POLICY IF EXISTS team_avatars_write ON storage.objects;
CREATE POLICY team_avatars_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-avatars'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = public.current_org_id()::text
  )
);

DROP POLICY IF EXISTS team_avatars_update ON storage.objects;
CREATE POLICY team_avatars_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-avatars'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = public.current_org_id()::text
  )
);

DROP POLICY IF EXISTS team_avatars_delete ON storage.objects;
CREATE POLICY team_avatars_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'team-avatars'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = public.current_org_id()::text
  )
);