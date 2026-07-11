-- ============================================================================
-- Feature: Due-payment recording + admin-issued temporary authorization codes
--
-- Part 1 — Due Payments
--   Receptionists/admins need to record additional payments against a
--   booking at any time (not just at checkout), without ever letting the
--   frontend be the source of truth for "is this amount allowed?". The
--   record_payment() function below runs entirely on the database: it locks
--   the booking row, validates the amount against the *current* remaining
--   balance, inserts the transaction, and updates the booking's paid amount
--   and payment status — all in one atomic, server-enforced step. A client
--   can call this function with any number it likes; the database will
--   reject anything that overpays the booking.
--
-- Part 2 — Temporary Authorization Codes
--   Admins can mint a short-lived, single-use numeric code. A receptionist
--   supplies that code to perform a protected action (currently: deleting a
--   booking). Both the code check and the delete happen inside
--   delete_booking_with_code(), a SECURITY DEFINER function — so even though
--   the "bookings_delete" RLS policy still restricts raw deletes to admins,
--   a receptionist can perform a delete *through this function* only when a
--   valid, unexpired, unused, admin-issued code is supplied. This keeps all
--   verification on the backend; there is no client-side bypass.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- record_payment: atomically record an additional payment on a booking
-- ----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_remaining numeric;
  v_new_advance numeric;
  v_new_status text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to record payments';
  end if;

  if p_payment_method not in ('cash', 'esewa', 'khalti', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status = 'cancelled' then
    raise exception 'Cannot record a payment on a cancelled booking';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  v_remaining := v_booking.total_amount - v_booking.advance_paid;

  if p_amount > v_remaining then
    raise exception 'Payment amount (%) exceeds the remaining balance (%)', p_amount, v_remaining;
  end if;

  insert into public.transactions (booking_id, guest_id, amount, payment_method, transaction_type, notes, created_by)
  values (
    p_booking_id,
    v_booking.guest_id,
    p_amount,
    p_payment_method,
    case when (v_booking.advance_paid + p_amount) >= v_booking.total_amount then 'final' else 'partial' end,
    p_notes,
    auth.uid()
  );

  v_new_advance := v_booking.advance_paid + p_amount;
  v_new_status := case
    when v_new_advance <= 0 then 'unpaid'
    when v_new_advance >= v_booking.total_amount then 'paid'
    else 'partial'
  end;

  update public.bookings
  set advance_paid = v_new_advance,
      payment_status = v_new_status
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.record_payment(uuid, numeric, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- AUTH CODES
-- ----------------------------------------------------------------------------
create table if not exists public.auth_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  created_by  uuid not null references public.profiles (id),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_auth_codes_code_active on public.auth_codes (code) where used_at is null;

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,
  booking_id    uuid references public.bookings (id) on delete set null,
  performed_by  uuid references public.profiles (id),
  admin_id      uuid references public.profiles (id),
  auth_code_id  uuid references public.auth_codes (id),
  details       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

alter table public.auth_codes enable row level security;
alter table public.audit_logs enable row level security;

-- Only admins can browse codes / audit history from the client. All writes
-- to these two tables happen exclusively inside the SECURITY DEFINER
-- functions below (no insert/update/delete policy is granted to any role),
-- so a client can never forge a code or an audit entry directly.
create policy "auth_codes_admin_select" on public.auth_codes for select using (public.is_admin());
create policy "audit_logs_admin_select" on public.audit_logs for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- generate_auth_code: admin-only, mints a fresh 6-digit code valid 3 minutes
-- ----------------------------------------------------------------------------
create or replace function public.generate_auth_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_expires timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can generate an authorization code';
  end if;

  -- Invalidate this admin's previous still-active codes so only the latest
  -- one they handed out is valid, avoiding confusion about which is live.
  update public.auth_codes
  set used_at = now()
  where created_by = auth.uid() and used_at is null and expires_at > now();

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expires := now() + interval '3 minutes';

  insert into public.auth_codes (code, created_by, expires_at)
  values (v_code, auth.uid(), v_expires);

  return query select v_code, v_expires;
end;
$$;

grant execute on function public.generate_auth_code() to authenticated;

-- ----------------------------------------------------------------------------
-- delete_booking_with_code: verifies a code server-side, then deletes
--
-- The booking's number is captured into audit_logs.details *before* the
-- delete happens, because booking_id's foreign key is ON DELETE SET NULL —
-- once the booking row is gone, audit_logs.booking_id would otherwise be
-- nulled out too, losing which booking was deleted.
-- ----------------------------------------------------------------------------
create or replace function public.delete_booking_with_code(p_booking_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_code public.auth_codes;
  v_booking_number text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized';
  end if;

  select booking_number into v_booking_number from public.bookings where id = p_booking_id;
  if v_booking_number is null then
    raise exception 'Booking not found';
  end if;

  select * into v_auth_code
  from public.auth_codes
  where code = p_code
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Invalid authorization code';
  end if;

  if v_auth_code.used_at is not null then
    raise exception 'This authorization code has already been used';
  end if;

  if v_auth_code.expires_at <= now() then
    raise exception 'This authorization code has expired';
  end if;

  update public.auth_codes
  set used_at = now(), used_by = auth.uid()
  where id = v_auth_code.id;

  insert into public.audit_logs (action, booking_id, performed_by, admin_id, auth_code_id, details)
  values (
    'delete_booking',
    p_booking_id,
    auth.uid(),
    v_auth_code.created_by,
    v_auth_code.id,
    jsonb_build_object('booking_number', v_booking_number)
  );

  delete from public.bookings where id = p_booking_id;
end;
$$;

grant execute on function public.delete_booking_with_code(uuid, text) to authenticated;
