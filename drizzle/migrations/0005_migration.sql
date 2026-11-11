-- Shared (global) music may only be reached through the app's licensed playback
-- path, which signs links server-side after checking the licence. Signed-in
-- accounts can no longer read or list the global folder directly. Super admins
-- keep full read access; clinics keep read access to their own uploads.
DROP POLICY IF EXISTS audio_files_bucket_select ON storage.objects;
CREATE POLICY audio_files_bucket_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (
      public.is_super_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] <> 'global'
        AND (storage.foldername(name))[1] = (public.current_org_id())::text
      )
    )
  );