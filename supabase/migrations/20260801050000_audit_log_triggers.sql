-- ============================================================================
-- Activity Log expansion — extends the existing audit_logs table (already
-- created in 20260711000000_payments_and_auth_codes.sql, used today only by
-- delete_booking_with_code()) to also capture payments, refunds, expense
-- CRUD, room CRUD, guest CRUD, booking create/update, and staff CRUD.
--
-- Implemented as AFTER triggers rather than editing every page's insert/
-- update/delete call, because:
--   - The frontend already performs most of these writes as plain
--     supabase.from(...).insert/update/delete() calls (not through RPCs),
--     so there is no single choke point in application code to hook into
--     without touching many files and risking a regression.
--   - A trigger fires no matter which code path performed the write (direct
--     client call, an RPC, or a future admin script), so the log can never
--     be bypassed or fall out of sync with a new call site.
--   - Zero changes to any existing page, dialog, or RPC are required — this
--     migration is purely additive, exactly matching the "don't modify
--     existing features" rule.
--
-- audit_logs has RLS enabled with no insert policy for any client role (only
-- an admin-only select policy), so the trigger function must be SECURITY
-- DEFINER to bypass RLS and write the log entry — the same pattern already
-- used by delete_booking_with_code() and record_payment().
--
-- bookings DELETE is intentionally NOT covered here: delete_booking_with_code()
-- already inserts its own 'delete_booking' audit_logs row before deleting,
-- so an additional trigger-based entry would just duplicate it.
-- ============================================================================

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_booking_id uuid;
  v_details jsonb;
begin
  if TG_TABLE_NAME = 'transactions' then
    v_action := case when new.transaction_type = 'refund' then 'refund' else 'payment' end;
    v_booking_id := new.booking_id;
    v_details := jsonb_build_object('amount', new.amount, 'payment_method', new.payment_method, 'transaction_type', new.transaction_type);
  elsif TG_TABLE_NAME = 'bookings' then
    v_action := 'booking_' || lower(TG_OP);
    v_booking_id := coalesce(new.id, old.id);
    v_details := jsonb_build_object('booking_number', coalesce(new.booking_number, old.booking_number));
  elsif TG_OP = 'DELETE' then
    v_action := TG_TABLE_NAME || '_deleted';
    v_details := to_jsonb(old) - 'created_at' - 'updated_at';
  else
    v_action := TG_TABLE_NAME || '_' || lower(TG_OP);
    v_details := to_jsonb(new) - 'created_at' - 'updated_at';
  end if;

  insert into public.audit_logs (action, booking_id, performed_by, details)
  values (v_action, v_booking_id, auth.uid(), v_details);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_transactions on public.transactions;
create trigger trg_audit_transactions
  after insert on public.transactions
  for each row execute function public.log_audit_event();

drop trigger if exists trg_audit_bookings on public.bookings;
create trigger trg_audit_bookings
  after insert or update on public.bookings
  for each row execute function public.log_audit_event();

drop trigger if exists trg_audit_expenses on public.expenses;
create trigger trg_audit_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.log_audit_event();

drop trigger if exists trg_audit_rooms on public.rooms;
create trigger trg_audit_rooms
  after insert or update or delete on public.rooms
  for each row execute function public.log_audit_event();

drop trigger if exists trg_audit_guests on public.guests;
create trigger trg_audit_guests
  after insert or update on public.guests
  for each row execute function public.log_audit_event();

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.log_audit_event();
