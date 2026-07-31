-- ============================================================================
-- Login History — records a 'login' audit_logs entry whenever Supabase Auth
-- updates a user's last_sign_in_at (i.e. an actual successful sign-in, not
-- a token refresh, which does not touch that column).
--
-- Kept in its own migration, separate from 20260801050000_audit_log_triggers.sql,
-- because it is the one statement in this whole feature that touches the
-- auth schema instead of public — a standard, Supabase-documented pattern
-- (the same one used for "create a profile row on signup" triggers), but
-- isolated here so that if your specific project's permissions ever reject
-- it, that failure can't roll back the other (public-schema) audit log
-- triggers pasted in the previous migration.
-- ============================================================================

create or replace function public.log_login_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (action, performed_by, details)
  values ('login', new.id, jsonb_build_object('email', new.email));
  return new;
end;
$$;

drop trigger if exists trg_audit_login on auth.users;
create trigger trg_audit_login
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.log_login_event();
