-- ============================================================================
-- Cancel a booking early, keeping already-collected payment as non-
-- refundable revenue.
--
-- Scenario this is for: a guest books N nights, then leaves early (or a
-- confirmed booking needs to be called off before check-in). Staff cancel it
-- from the Bookings list. This function:
--
--   1. Only allows cancelling 'confirmed' or 'checked_in' bookings — the two
--      statuses that ever reserve a room per the no_overlapping_room_bookings
--      exclusion constraint. Already-checked-out, already-cancelled/rejected,
--      or still-pending bookings can't be cancelled this way.
--
--   2. Sets booking_status = 'cancelled', which the exclusion constraint does
--      NOT check, so the room is immediately freed for rebooking - the same
--      mechanism checkout already relies on (see CheckoutDialog's comment:
--      booking dates are historical records, only booking_status determines
--      live availability - no room row needs to change either).
--
--   3. Clips total_amount down to whatever was actually collected
--      (advance_paid). remaining_balance is a generated column
--      (total_amount - advance_paid), so this makes it 0 automatically -
--      nothing further is owed for the cancelled remainder - while the
--      amount already paid is NOT refunded and stays as the booking's
--      total_amount. Every existing report that sums total_amount for
--      confirmed/checked_in/checked_out bookings can then keep using the
--      exact same total_amount field once 'cancelled' is added to that
--      counted set (done in the frontend report helpers, not here) - a
--      cancelled booking that never collected anything simply nets to $0
--      either way.
--
--   4. Adds a small audit trail (cancelled_at/by/reason) without touching
--      any other existing column, table, or function.
--
-- This does NOT auto-refund anything. If staff genuinely need to return
-- money, the existing Refund action (record_refund(), from
-- 20260801020000_booking_discount_tax_refund.sql) is separate and still
-- works before or after cancelling.
-- ============================================================================

alter table public.bookings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles (id),
  add column if not exists cancellation_reason text;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to cancel bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status not in ('confirmed', 'checked_in') then
    raise exception 'Only confirmed or checked-in bookings can be cancelled (this booking is %)', v_booking.booking_status;
  end if;

  update public.bookings
  set booking_status = 'cancelled',
      total_amount = advance_paid,
      payment_status = case when advance_paid > 0 then 'paid' else 'unpaid' end,
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.cancel_booking(uuid, text) to authenticated;
