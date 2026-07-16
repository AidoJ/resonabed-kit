
-- Allow global (org_id IS NULL) audio_files rows for shipped library
ALTER TABLE public.audio_files ALTER COLUMN org_id DROP NOT NULL;

-- Replace RLS policies to include global rows
DROP POLICY IF EXISTS "audio_files_select" ON public.audio_files;
DROP POLICY IF EXISTS "audio_files_insert" ON public.audio_files;
DROP POLICY IF EXISTS "audio_files_update" ON public.audio_files;
DROP POLICY IF EXISTS "audio_files_delete" ON public.audio_files;

-- Any authenticated user can read global (org_id IS NULL) or their own org's rows.
CREATE POLICY "audio_files_select" ON public.audio_files
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR org_id IS NULL
    OR org_id = current_org_id()
  );

-- Writes to global rows: super_admin only. Writes to org rows: that org's members.
CREATE POLICY "audio_files_insert" ON public.audio_files
  FOR INSERT TO authenticated
  WITH CHECK (
    (org_id IS NULL AND is_super_admin(auth.uid()))
    OR (org_id IS NOT NULL AND (is_super_admin(auth.uid()) OR org_id = current_org_id()))
  );

CREATE POLICY "audio_files_update" ON public.audio_files
  FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL AND is_super_admin(auth.uid()))
    OR (org_id IS NOT NULL AND (is_super_admin(auth.uid()) OR org_id = current_org_id()))
  )
  WITH CHECK (
    (org_id IS NULL AND is_super_admin(auth.uid()))
    OR (org_id IS NOT NULL AND (is_super_admin(auth.uid()) OR org_id = current_org_id()))
  );

CREATE POLICY "audio_files_delete" ON public.audio_files
  FOR DELETE TO authenticated
  USING (
    (org_id IS NULL AND is_super_admin(auth.uid()))
    OR (org_id IS NOT NULL AND (is_super_admin(auth.uid()) OR org_id = current_org_id()))
  );

-- Storage policies on audio-files bucket: allow 'global/<audio_id>.<ext>' paths.
-- Read: all authenticated users (global + own org). Write: super_admin for global,
-- org members for their org path.
DROP POLICY IF EXISTS "audio_files_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_bucket_delete" ON storage.objects;

CREATE POLICY "audio_files_bucket_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1] = 'global'
      OR (storage.foldername(name))[1] = current_org_id()::text
    )
  );

CREATE POLICY "audio_files_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio-files'
    AND (
      ((storage.foldername(name))[1] = 'global' AND is_super_admin(auth.uid()))
      OR ((storage.foldername(name))[1] <> 'global'
          AND (is_super_admin(auth.uid())
               OR (storage.foldername(name))[1] = current_org_id()::text))
    )
  );

CREATE POLICY "audio_files_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (
      ((storage.foldername(name))[1] = 'global' AND is_super_admin(auth.uid()))
      OR ((storage.foldername(name))[1] <> 'global'
          AND (is_super_admin(auth.uid())
               OR (storage.foldername(name))[1] = current_org_id()::text))
    )
  )
  WITH CHECK (
    bucket_id = 'audio-files'
    AND (
      ((storage.foldername(name))[1] = 'global' AND is_super_admin(auth.uid()))
      OR ((storage.foldername(name))[1] <> 'global'
          AND (is_super_admin(auth.uid())
               OR (storage.foldername(name))[1] = current_org_id()::text))
    )
  );

CREATE POLICY "audio_files_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (
      ((storage.foldername(name))[1] = 'global' AND is_super_admin(auth.uid()))
      OR ((storage.foldername(name))[1] <> 'global'
          AND (is_super_admin(auth.uid())
               OR (storage.foldername(name))[1] = current_org_id()::text))
    )
  );
