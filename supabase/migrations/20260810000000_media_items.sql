-- ============================================================================
-- Media Management (additive only — no existing table/policy is changed)
--
-- * media_items: metadata for images/videos shown on the public website.
-- * "site-media" storage bucket: public read, admin-only write, restricted
--   to image/video MIME types and a 50 MB size cap.
-- * RLS: the public website (anon) may only read rows where is_active = true.
--   Only admins (public.is_admin()) can read inactive rows or write anything.
-- ============================================================================

create table if not exists public.media_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'gallery' check (category in ('gallery', 'cafe', 'rooms', 'video_tour', 'other')),
  media_type   text not null check (media_type in ('image', 'video')),
  file_url     text not null,
  storage_path text not null,
  caption      text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_media_items_category_order on public.media_items (category, sort_order);

alter table public.media_items enable row level security;

drop policy if exists "media_items_public_select" on public.media_items;
create policy "media_items_public_select" on public.media_items
  for select using (is_active = true or public.is_admin());

drop policy if exists "media_items_admin_insert" on public.media_items;
create policy "media_items_admin_insert" on public.media_items
  for insert to authenticated with check (public.is_admin());

drop policy if exists "media_items_admin_update" on public.media_items;
create policy "media_items_admin_update" on public.media_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media_items_admin_delete" on public.media_items;
create policy "media_items_admin_delete" on public.media_items
  for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_media_public_select" on storage.objects;
create policy "site_media_public_select" on storage.objects
  for select using (bucket_id = 'site-media');

drop policy if exists "site_media_admin_insert" on storage.objects;
create policy "site_media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site_media_admin_update" on storage.objects;
create policy "site_media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site_media_admin_delete" on storage.objects;
create policy "site_media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());
