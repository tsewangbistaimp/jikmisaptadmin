-- ============================================================================
-- Update the guest-facing message sent by approve_payment()
--
-- Body-only change, same signature (CREATE OR REPLACE) — nothing else about
-- approve_payment() changes: same validation, same booking/transaction
-- updates, same two notification_log rows (sms always, email when the guest
-- has an address). Only the SMS message text and the email subject/body
-- wording change, to:
--   - explicitly thank the guest and say the 50% advance payment was
--     received (not just "verified"/"confirmed")
--   - say staff are happy to welcome them on their check-in day
--   - state the remaining balance is due within 2 days AFTER check-in,
--     instead of "due at check-in"
--
-- The payment screenshot itself was already optional at the database layer
-- (p_payment_screenshot_path already defaults to null here) — the only
-- place that required one was a client-side disabled={!screenshotUrl} on
-- the Approve Payment button, which was a separate frontend-only change
-- (already applied directly to src/components/bookings/OnlineBookingDialogs.tsx).
--
-- NOTE: this function body was already applied directly against the live
-- Supabase database via the SQL Editor on 2026-08-05. This migration file
-- is being added afterwards purely so the repo's migration history matches
-- what's actually running — running it again is a harmless no-op since
-- CREATE OR REPLACE FUNCTION is idempotent.
-- ============================================================================

create or replace function public.approve_payment(
  p_booking_id uuid,
  p_payment_screenshot_path text default null,
  p_payment_method text default 'bank_transfer',
  p_notes text default null,
  p_device text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_room public.rooms;
  v_staff_name text;
  v_message text;
  v_advance numeric;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to approve payments';
  end if;

  if p_payment_method not in ('cash', 'esewa', 'khalti', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'payment_under_review' then
    raise exception 'Only bookings awaiting payment review can be confirmed';
  end if;

  select full_name into v_staff_name from public.profiles where id = auth.uid();
  v_advance := round(v_booking.total_amount * 0.5, 2);

  perform set_config('app.audit_device', coalesce(p_device, ''), true);

  begin
    update public.bookings
    set booking_status = 'confirmed',
        payment_screenshot_path = coalesce(p_payment_screenshot_path, payment_screenshot_path),
        payment_verified_at = now(),
        payment_verified_by = auth.uid(),
        payment_verified_by_name = v_staff_name,
        admin_notes = coalesce(p_notes, admin_notes),
        payment_status = 'partial',
        advance_paid = v_advance
    where id = p_booking_id
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'This room is already booked for overlapping dates by another confirmed booking. Reject this request instead.';
  end;

  insert into public.transactions (booking_id, guest_id, amount, payment_method, transaction_type, notes, created_by)
  values (
    p_booking_id,
    v_booking.guest_id,
    v_advance,
    p_payment_method,
    'advance',
    'Advance payment verified from guest-submitted screenshot',
    auth.uid()
  );

  select * into v_guest from public.guests where id = v_booking.guest_id;
  select * into v_room from public.rooms where id = v_booking.room_id;

  v_message := format(
    E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nThank you! We have received your 50%% advance payment and your booking is now confirmed.\n\nBooking Number:\n%s\n\nRoom:\n%s / %s\n\nCheck-in:\n%s\n\nCheck-out:\n%s\n\nTotal Amount:\nNPR %s\n\nAdvance Paid:\nNPR %s\n\nRemaining Balance:\nNPR %s (please settle this within 2 days after your check-in date)\n\nWe are happy and look forward to welcoming you on your check-in day.\n\nPlease bring a valid government-issued ID at check-in.\n\nThank you for choosing Jikmis Apartment.',
    coalesce(v_guest.full_name, 'Guest'),
    v_booking.booking_number,
    coalesce(v_room.room_number, ''),
    coalesce(v_room.room_type, ''),
    v_booking.check_in::text,
    v_booking.check_out::text,
    v_booking.total_amount::text,
    v_advance::text,
    (v_booking.total_amount - v_advance)::text
  );

  insert into public.notification_log (booking_id, guest_id, channel, template, recipient, message, status)
  values (p_booking_id, v_booking.guest_id, 'sms', 'booking_approved', coalesce(v_guest.phone, ''), v_message, 'pending');

  if v_guest.email is not null and length(trim(v_guest.email)) > 0 then
    insert into public.notification_log (booking_id, guest_id, channel, template, recipient, subject, message, status)
    values (
      p_booking_id,
      v_booking.guest_id,
      'email',
      'booking_approved',
      trim(v_guest.email),
      'Advance Payment Received – Jikmis Apartment',
      format(
        E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nThank you! We have received your 50%% advance payment and your booking is now confirmed.\n\nBooking Number:\n%s\n\nRoom:\n%s\n\nCheck-in Date:\n%s\n\nCheck-out Date:\n%s\n\nTotal Amount:\nNPR %s\n\nAdvance Paid:\nNPR %s\n\nRemaining Balance:\nNPR %s\n\nPlease note: the remaining balance must be paid within 2 days after your check-in date.\n\nWe are delighted and look forward to welcoming you on your check-in day.\n\nPlease bring a valid government-issued identification document during check-in.\n\nIf you need assistance before your arrival, please contact us.\n\nThank you for choosing Jikmis Apartment.\n\nJikmis Apartment',
        coalesce(v_guest.full_name, 'Guest'),
        v_booking.booking_number,
        coalesce(v_room.room_number, ''),
        v_booking.check_in::text,
        v_booking.check_out::text,
        v_booking.total_amount::text,
        v_advance::text,
        (v_booking.total_amount - v_advance)::text
      ),
      'pending'
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.approve_payment(uuid, text, text, text, text) to authenticated;
