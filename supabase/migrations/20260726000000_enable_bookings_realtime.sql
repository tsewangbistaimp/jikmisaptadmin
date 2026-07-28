-- ============================================================================
-- Enable Supabase Realtime on the bookings table.
--
-- The Dashboard now subscribes to postgres_changes on public.bookings so
-- the Room Availability card (and everything else on the Dashboard) can
-- refresh itself the instant a booking is created, edited, checked out,
-- or deleted anywhere in the app — no manual page reload needed.
--
-- Realtime only broadcasts changes for tables that have been added to the
-- "supabase_realtime" publication. This is normally toggled from
-- Database -> Replication in the Supabase dashboard; this migration does
-- the same thing via SQL so it's tracked like every other schema change.
-- It's written to be safe to run more than once (it only adds the table
-- if it isn't already in the publication).
--
-- Existing RLS policies on bookings (bookings_select: any active staff)
-- still apply — Realtime only notifies a subscriber about rows they are
-- otherwise allowed to select.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
