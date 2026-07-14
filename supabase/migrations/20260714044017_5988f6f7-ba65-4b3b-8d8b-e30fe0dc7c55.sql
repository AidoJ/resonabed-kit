
create policy "audio_files_bucket_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audio-files'
    and (
      public.is_super_admin(auth.uid())
      or ((storage.foldername(name))[1])::uuid = public.current_org_id()
    )
  );

create policy "audio_files_bucket_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audio-files'
    and (
      public.is_super_admin(auth.uid())
      or ((storage.foldername(name))[1])::uuid = public.current_org_id()
    )
  );

create policy "audio_files_bucket_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'audio-files'
    and (
      public.is_super_admin(auth.uid())
      or ((storage.foldername(name))[1])::uuid = public.current_org_id()
    )
  )
  with check (
    bucket_id = 'audio-files'
    and (
      public.is_super_admin(auth.uid())
      or ((storage.foldername(name))[1])::uuid = public.current_org_id()
    )
  );

create policy "audio_files_bucket_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'audio-files'
    and (
      public.is_super_admin(auth.uid())
      or ((storage.foldername(name))[1])::uuid = public.current_org_id()
    )
  );
