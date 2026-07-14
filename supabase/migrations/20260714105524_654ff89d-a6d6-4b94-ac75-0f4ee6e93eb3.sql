
-- profiles.is_active (display only; enforcement is via Auth ban)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- organisations.logo_path (storage object path)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS logo_path text;

-- Storage policies for org-logos bucket
CREATE POLICY "org_logos_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR ((storage.foldername(name))[1])::uuid = public.current_org_id()
  )
);

CREATE POLICY "org_logos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      ((storage.foldername(name))[1])::uuid = public.current_org_id()
      AND public.is_org_admin(auth.uid(), public.current_org_id())
    )
  )
);

CREATE POLICY "org_logos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      ((storage.foldername(name))[1])::uuid = public.current_org_id()
      AND public.is_org_admin(auth.uid(), public.current_org_id())
    )
  )
)
WITH CHECK (
  bucket_id = 'org-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      ((storage.foldername(name))[1])::uuid = public.current_org_id()
      AND public.is_org_admin(auth.uid(), public.current_org_id())
    )
  )
);

CREATE POLICY "org_logos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      ((storage.foldername(name))[1])::uuid = public.current_org_id()
      AND public.is_org_admin(auth.uid(), public.current_org_id())
    )
  )
);
