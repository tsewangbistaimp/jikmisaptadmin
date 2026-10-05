-- Adds a 'banner' category to media_items so the home-page hero banner
-- (video or images) can be managed from Media Management. Additive only:
-- every previously allowed category stays allowed.
alter table public.media_items drop constraint if exists media_items_category_check;
alter table public.media_items add constraint media_items_category_check
  check (category in ('gallery', 'cafe', 'rooms', 'video_tour', 'banner', 'other'));
