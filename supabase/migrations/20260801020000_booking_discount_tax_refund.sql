-- ============================================================================
-- Guest & booking financials: discount/tax tracking + server-validated refunds
--
--   1. bookings.discount / bookings.tax — additive, informational columns
--      (default 0) so an itemized invoice can show what was discounted or
--      taxed. They do NOT auto-recompute total_amount: total_amount stays
--      the single manually-maintained "grand total" field it already is
--      (the same way booking_services add-ons adjust it today, via explicit
--      client-side +/- deltas in EditBookingDialog) — this avoids touching
--      the generated remaining_balance column's existing semantics or any
--      report that already sums total_amount as revenue.
--
--   2. record_refund() — the mirror image of record_payment(): the existing
--      'refund' transaction_type has been a schema stub with zero code path
--      inserting it. This function locks the booking row, validates the
--      refund against the *currently paid* amount (can't refund more than
--      was actually collected), inserts a 'refund' transaction, and
--      decrements advance_paid / recalculates payment_status — all
--      server-side, so a client can't forge a refund larger than what was
--      paid even by editing frontend code.
-- ============================================================================

alter table public.bookings
  add column if not exists discount numeric(12, 2) not null default 0 check (discount >= 0),
  add column if not exists tax numeric(12, 2) not null default 0 check (tax >= 0);

create or replace function public.record_refund(
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
  v_new_advance numeric;
  v_new_status text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to record refunds';
  end if;

  if p_payment_method not in ('cash', 'esewa', 'khalti', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  if p_amount > v_booking.advance_paid then
    raise exception 'Refund amount (%) exceeds the amount paid (%)', p_amount, v_booking.advance_paid;
  end if;

  insert into public.transactions (booking_id, guest_id, amount, payment_method, transaction_type, notes, created_by)
  values (p_booking_id, v_booking.guest_id, p_amount, p_payment_method, 'refund', p_notes, auth.uid());

  v_new_advance := v_booking.advance_paid - p_amount;
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

grant execute on function public.record_refund(uuid, numeric, text, text) to authenticated;
