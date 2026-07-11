-- ============================================================================
-- Room photos + rename studio types
--
-- Adds an image_url column to rooms and a public "room-images" storage
-- bucket so admins can upload a photo per room from the Rooms page. The
-- bucket is public for reads (so <img> tags can load photos directly with
-- no auth), but only active staff can upload/replace/delete files in it.
-- ============================================================================

alter table public.rooms add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', true)
on conflict (id) do update set public = true;

-- RLS is already enabled on storage.objects by default in every Supabase
-- project (and only Supabase's internal role can toggle it), so we only
-- need to add policies here, not enable RLS ourselves.

drop policy if exists "room_images_public_select" on storage.objects;
create policy "room_images_public_select" on storage.objects
  for select using (bucket_id = 'room-images');

drop policy if exists "room_images_staff_insert" on storage.objects;
create policy "room_images_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'room-images' and public.is_active_staff());

drop policy if exists "room_images_staff_update" on storage.objects;
create policy "room_images_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'room-images' and public.is_active_staff());

drop policy if exists "room_images_staff_delete" on storage.objects;
create policy "room_images_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'room-images' and public.is_active_staff());

-- Rename studio types as requested: 101/201 are single studios, 102/202 are
-- double studios.
update public.rooms set room_type = 'Single Studio' where room_number in ('101', '201');
update public.rooms set room_type = 'Double Studio' where room_number in ('102', '202');
