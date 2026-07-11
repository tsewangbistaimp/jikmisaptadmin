-- ============================================================================
-- Guest identity photo
--
-- Unlike room photos, ID/passport photos are sensitive personal documents,
-- so this bucket is private (public = false). Only active staff can upload
-- or view files in it, and the app must always use a short-lived signed URL
-- to display one — there is no public URL for this bucket.
-- ============================================================================

alter table public.guests add column if not exists id_document_path text;

insert into storage.buckets (id, name, public)
values ('guest-documents', 'guest-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "guest_documents_staff_select" on storage.objects;
create policy "guest_documents_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'guest-documents' and public.is_active_staff());

drop policy if exists "guest_documents_staff_insert" on storage.objects;
create policy "guest_documents_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guest-documents' and public.is_active_staff());

drop policy if exists "guest_documents_staff_update" on storage.objects;
create policy "guest_documents_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'guest-documents' and public.is_active_staff());

drop policy if exists "guest_documents_staff_delete" on storage.objects;
create policy "guest_documents_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guest-documents' and public.is_active_staff());
