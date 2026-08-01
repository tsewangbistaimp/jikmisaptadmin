-- ============================================================================
-- Gmail Sender Account for Booking Emails
--
-- Purely additive on top of the approval/notification migrations
-- (20260801080000, 20260801100000). Adds:
--
--   1. notification_log.subject — email needs a subject line separate from
--      the message body; SMS/WhatsApp rows simply leave it null.
--   2. guests.email is now actually populated: create_public_booking() gets
--      a new optional p_email parameter (dropped + re-created since
--      appending a parameter is a new signature in Postgres, not a
--      replacement — same reason approve_booking()/reject_booking() were
--      dropped and re-created in 20260801100000).
--   3. approve_booking() / reject_booking(): when the guest has an email on
--      file, ALSO queue an 'email' notification_log row (in addition to the
--      existing 'sms' row) with the exact subject + body specified for
--      Gmail delivery. The 'sms' row is untouched and keeps queuing exactly
--      as before — nothing about the SMS/WhatsApp path changes.
--
--   Actually SENDING the email (via Gmail SMTP) happens client-side in the
--   admin dashboard's NotificationService -> emailProvider.ts -> a new
--   `send-email` Supabase Edge Function, since an SMTP password must never
--   be shipped to the browser. This migration only queues the email; see
--   the accompanying edge function and emailProvider.ts changes.
-- ============================================================================

alter table public.notification_log
  add column if not exists subject text;

-- ----------------------------------------------------------------------------
-- create_public_booking — adds p_email (optional). Same validation/pricing/
-- availability logic as the 20260801100000 version, unchanged.
-- ----------------------------------------------------------------------------
drop function if exists public.create_public_booking(uuid, date, date, int, text, text, text, text, text);

create or replace function public.create_public_booking(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_full_name text,
  p_phone text,
  p_nationality text default null,
  p_passport_number text default null,
  p_notes text default null,
  p_email text default null
)
returns table (
  booking_id uuid,
  booking_number text,
  room_number text,
  room_type text,
  check_in date,
  check_out date,
  nights int,
  total_amount numeric,
  pricing_method text,
  booking_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_guest_id uuid;
  v_booking public.bookings;
  v_price record;
begin
  if p_check_in is null or p_check_out is null then
    raise exception 'Check-in and check-out dates are required';
  end if;

  if p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in';
  end if;

  if p_check_in < current_date then
    raise exception 'Check-in date cannot be in the past';
  end if;

  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'Guest name is required';
  end if;

  if p_phone is null or length(trim(p_phone)) < 7 then
    raise exception 'Enter a valid phone number';
  end if;

  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'At least 1 guest is required';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'Selected room could not be found';
  end if;

  if v_room.status = 'maintenance' then
    raise exception 'This room is currently unavailable for booking';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.room_id = p_room_id
      and b.booking_status in ('confirmed', 'checked_in')
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'This room is no longer available for the selected dates';
  end if;

  select * into v_price from public.calculate_booking_price(p_room_id, p_check_in, p_check_out);

  insert into public.guests (full_name, phone, email, nationality, passport_number, guest_count, notes)
  values (
    trim(p_full_name),
    trim(p_phone),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_nationality, '')), ''),
    nullif(trim(coalesce(p_passport_number, '')), ''),
    p_guest_count,
    p_notes
  )
  returning id into v_guest_id;

  begin
    insert into public.bookings (
      guest_id, room_id, guest_count, check_in, check_out,
      total_amount, pricing_method, advance_paid, booking_source, payment_status, booking_status, notes
    ) values (
      v_guest_id, p_room_id, p_guest_count, p_check_in, p_check_out,
      v_price.total_amount, v_price.pricing_method, 0, 'website', 'unpaid', 'pending_approval', p_notes
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'This room was just booked for an overlapping date range. Please choose another room or different dates.';
  end;

  return query
    select
      v_booking.id,
      v_booking.booking_number,
      v_room.room_number,
      v_room.room_type,
      v_booking.check_in,
      v_booking.check_out,
      v_booking.nights,
      v_booking.total_amount,
      v_booking.pricing_method,
      v_booking.booking_status;
end;
$$;

grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text, text) to anon;
grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- approve_booking / reject_booking — same signature as 20260801100000 (no
-- drop needed), body-only change: also queue an 'email' notification when
-- the guest has an email on file, using the exact Gmail subject/body.
-- ----------------------------------------------------------------------------
create or replace function public.approve_booking(p_booking_id uuid, p_device text default null)
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
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to approve bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'pending_approval' then
    raise exception 'Only pending bookings can be approved';
  end if;

  select full_name into v_staff_name from public.profiles where id = auth.uid();

  perform set_config('app.audit_device', coalesce(p_device, ''), true);

  begin
    update public.bookings
    set booking_status = 'confirmed',
        approved_at = now(),
        approved_by = auth.uid(),
        approved_by_name = v_staff_name
    where id = p_booking_id
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'This room is already booked for overlapping dates by another confirmed booking. Reject or modify this request instead.';
  end;

  select * into v_guest from public.guests where id = v_booking.guest_id;
  select * into v_room from public.rooms where id = v_booking.room_id;

  v_message := format(
    E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nYour booking request has been approved successfully.\n\nBooking Number:\n%s\n\nApartment:\nJikmis Apartment\n\nRoom:\n%s / %s\n\nConfirmed On:\n%s\n\nCheck-in:\n%s\n\nCheck-out:\n%s\n\nTotal Amount:\nNPR %s\n\nPlease arrive during our standard check-in hours and bring a valid government-issued ID.\n\nThank you for choosing Jikmis Apartment.\n\nWe look forward to welcoming you.',
    coalesce(v_guest.full_name, 'Guest'),
    v_booking.booking_number,
    coalesce(v_room.room_number, ''),
    coalesce(v_room.room_type, ''),
    to_char(now(), 'YYYY-MM-DD'),
    v_booking.check_in::text,
    v_booking.check_out::text,
    v_booking.total_amount::text
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
      'Booking Confirmed – Jikmis Apartment',
      format(
        E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nWe are pleased to inform you that your booking request has been successfully approved and confirmed.\n\nBooking Number:\n%s\n\nRoom:\n%s\n\nBooking Confirmed On:\n%s\n\nCheck-in Date:\n%s\n\nCheck-out Date:\n%s\n\nTotal Amount:\nNPR %s\n\nPlease bring a valid government-issued identification document during check-in.\n\nIf you need assistance before your arrival, please contact us.\n\nThank you for choosing Jikmis Apartment.\n\nWe look forward to welcoming you.\n\nJikmis Apartment',
        coalesce(v_guest.full_name, 'Guest'),
        v_booking.booking_number,
        coalesce(v_room.room_number, ''),
        to_char(now(), 'YYYY-MM-DD'),
        v_booking.check_in::text,
        v_booking.check_out::text,
        v_booking.total_amount::text
      ),
      'pending'
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.approve_booking(uuid, text) to authenticated;

create or replace function public.reject_booking(p_booking_id uuid, p_reason text, p_device text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_guest public.guests;
  v_staff_name text;
  v_message text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to reject bookings';
  end if;

  if p_reason is null or length(trim(p_reason)) < 2 then
    raise exception 'A rejection reason is required';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'pending_approval' then
    raise exception 'Only pending bookings can be rejected';
  end if;

  select full_name into v_staff_name from public.profiles where id = auth.uid();

  perform set_config('app.audit_device', coalesce(p_device, ''), true);

  update public.bookings
  set booking_status = 'rejected',
      rejected_at = now(),
      rejected_by = auth.uid(),
      rejected_by_name = v_staff_name,
      rejection_reason = trim(p_reason)
  where id = p_booking_id
  returning * into v_booking;

  select * into v_guest from public.guests where id = v_booking.guest_id;

  v_message := format(
    E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nWe sincerely apologize.\n\nUnfortunately your booking request could not be confirmed.\n\nReason:\n\n%s\n\nIf you have already made an advance payment, our team will contact you regarding the refund process.\n\nWe apologize for the inconvenience.\n\nThank you for your understanding.\n\nJikmis Apartment',
    coalesce(v_guest.full_name, 'Guest'),
    v_booking.rejection_reason
  );

  insert into public.notification_log (booking_id, guest_id, channel, template, recipient, message, status)
  values (p_booking_id, v_booking.guest_id, 'sms', 'booking_rejected', coalesce(v_guest.phone, ''), v_message, 'pending');

  if v_guest.email is not null and length(trim(v_guest.email)) > 0 then
    insert into public.notification_log (booking_id, guest_id, channel, template, recipient, subject, message, status)
    values (
      p_booking_id,
      v_booking.guest_id,
      'email',
      'booking_rejected',
      trim(v_guest.email),
      'Booking Request Update – Jikmis Apartment',
      format(
        E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nUnfortunately we are unable to confirm your booking request.\n\nReason:\n\n%s\n\nIf you have already made an advance payment, our team will contact you regarding the refund process according to our cancellation policy.\n\nYou are welcome to make another booking for different dates.\n\nThank you for your understanding.\n\nKind Regards,\n\nJikmis Apartment',
        coalesce(v_guest.full_name, 'Guest'),
        v_booking.rejection_reason
      ),
      'pending'
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.reject_booking(uuid, text, text) to authenticated;
