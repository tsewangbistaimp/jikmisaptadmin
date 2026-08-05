-- ============================================================================
-- Guest Email Verification + Admin Payment-Screenshot Review
--
-- Purely additive on top of the existing approval-workflow migrations. Does
-- not rename, drop, or change the meaning of any existing column, function,
-- or status value. Every existing booking flow (walk-in/phone/admin-created
-- bookings, the existing pending_approval -> approve_booking()/
-- reject_booking() legitimacy review, the existing RecordPayment/refund
-- flow, the existing no_overlapping_room_bookings reservation guarantee)
-- keeps working exactly as it already does.
--
-- What this adds, end to end:
--
--   1. bookings: email_verified / phone_verified / verified_at — set once,
--      at creation, by create_public_booking() itself (see below). phone_
--      verified stays FALSE for now — there is no SMS/OTP provider
--      configured yet (same situation as WhatsApp integration, deferred
--      earlier), so this column exists and is displayed honestly as
--      "not verified" rather than faked. Wiring up real SMS OTP later is a
--      matter of adding a verify-phone-otp edge function and setting this
--      column true from it — no schema change needed then.
--   2. bookings: payment_screenshot_path / payment_verified_at /
--      payment_verified_by / payment_verified_by_name / admin_notes — the
--      new payment-review fields, same "who/when" snapshot pattern as the
--      existing approved_at/approved_by/approved_by_name columns.
--   3. booking_status check constraint widened to add 'payment_under_review'
--      and 'expired' — every existing value stays valid. Neither new value
--      is added to the no_overlapping_room_bookings exclusion constraint's
--      blocking set, so neither one reserves a room — only 'confirmed'/
--      'checked_in' ever have, unchanged.
--   4. notification_log.template widened to add 'pending_confirmation' and
--      'payment_screenshot_requested' (guest-facing) — same outbox table,
--      same dispatch path (NotificationService -> send-email edge
--      function), nothing new to deploy for delivery itself.
--   5. email_otp_verifications — a new, narrowly-scoped table for the OTP
--      codes themselves. RLS is enabled with ZERO policies, so no role
--      (anon or authenticated) can read or write it directly through
--      PostgREST at all; it is only ever touched by the send-email-otp /
--      verify-email-otp edge functions (service-role client, bypasses RLS
--      entirely) and by create_public_booking() (SECURITY DEFINER, also
--      bypasses RLS) when it checks a token at booking-creation time. This
--      mirrors notification_log's existing "outbox nobody can read/write
--      except the trusted server-side path" pattern.
--   6. create_public_booking(): dropped + re-created (adding a parameter is
--      a new signature in Postgres, not a replacement — same reason
--      approve_booking()/reject_booking() were dropped and re-created
--      before) with a new required p_verification_token parameter. Before
--      creating anything, it now re-checks server-side that this exact
--      email was actually verified recently via email_otp_verifications —
--      a client can never skip verification by simply not calling the
--      verify step, because the database itself refuses to create the
--      booking without proof. Every other validation/pricing/availability
--      rule in this function is byte-for-byte unchanged.
--   7. approve_booking(): body-only change (same signature, so a plain
--      CREATE OR REPLACE). Previously took a pending_approval request
--      straight to 'confirmed' (reserving the room) in one step. Now takes
--      it to the new 'payment_under_review' status instead — still not
--      reserved — and no longer queues a "booking confirmed" notification
--      here (the guest already received the payment-instructions email at
--      submission time from notify-new-booking; sending a second, different
--      email at this internal-only transition would be confusing). The
--      room is only ever reserved by the new approve_payment() below, once
--      staff has actually verified the 50% advance payment — this is the
--      literal implementation of "never reserve a room until the admin
--      approves the advance payment."
--   8. approve_payment() / reject_payment() / request_new_payment_screenshot()
--      / admin_update_booking_note() — the new staff-only actions. approve_
--      payment() is where 'confirmed' + the reservation + the guest
--      confirmation email now actually happen (moved here verbatim from
--      where they used to live in approve_booking()), and it also records a
--      real transactions row (transaction_type = 'advance') for the
--      verified amount, so Reports/Transactions/the guest's payment history
--      reflect it exactly as if staff had used the existing Record Payment
--      flow — nothing about that reporting path needed to change to pick
--      this up.
--   9. expire_stale_payment_reviews() — a staff-callable sweep (called
--      opportunistically from the admin dashboard on load, since this
--      project has no cron/scheduled-task infrastructure) that flips any
--      website booking sitting in pending_approval or payment_under_review
--      for more than 24 hours, with no verified payment, to 'expired'.
--      Deliberately does not send any additional guest notification — the
--      guest was already told in their very first email that an unpaid
--      request may be auto-cancelled, so a silent internal status flip is
--      consistent with what they were already told, and avoids queuing a
--      notification_log row that nothing would ever dispatch (this app's
--      NotificationService only ever sends right after an explicit staff
--      action in the dashboard, there is no background sender).
--  10. log_audit_event(): body-only change (same signature) — recognizes
--      the new transitions with clear action names, same as it already
--      special-cases pending_approval -> confirmed / rejected.
--  11. payment-screenshots storage bucket — private, staff-only, identical
--      RLS shape to the existing guest-documents bucket. Per the chosen
--      workflow, the GUEST sends the payment screenshot via WhatsApp and
--      STAFF uploads it here when reviewing (not a guest-facing upload
--      endpoint), so only `authenticated` + is_active_staff() ever touches
--      this bucket, exactly like guest-documents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 & 2. New booking columns
-- ----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists payment_screenshot_path text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles (id),
  add column if not exists payment_verified_by_name text,
  add column if not exists admin_notes text;

-- ----------------------------------------------------------------------------
-- 3. Widen booking_status — additive only, every existing value kept.
-- ----------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_booking_status_check;
alter table public.bookings add constraint bookings_booking_status_check
  check (booking_status in (
    'pending_approval', 'payment_under_review', 'confirmed', 'checked_in',
    'checked_out', 'cancelled', 'rejected', 'expired'
  ));

-- ----------------------------------------------------------------------------
-- 4. Widen notification_log.template — additive only.
-- ----------------------------------------------------------------------------
alter table public.notification_log drop constraint if exists notification_log_template_check;
alter table public.notification_log add constraint notification_log_template_check
  check (template in (
    'booking_approved', 'booking_rejected', 'new_booking_alert',
    'pending_confirmation', 'payment_screenshot_requested'
  ));

-- ----------------------------------------------------------------------------
-- 5. email_otp_verifications — new table, RLS enabled, zero policies.
-- ----------------------------------------------------------------------------
create table if not exists public.email_otp_verifications (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  code_hash          text not null,
  verification_token text,
  attempts           int not null default 0,
  verified           boolean not null default false,
  verified_at        timestamptz,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_email_otp_email on public.email_otp_verifications (email);
create index if not exists idx_email_otp_token on public.email_otp_verifications (verification_token) where verification_token is not null;

alter table public.email_otp_verifications enable row level security;
-- No policies added on purpose — every role except the service-role client
-- (edge functions) and SECURITY DEFINER functions (which bypass RLS
-- entirely, same as every other SECURITY DEFINER function in this schema)
-- is denied both read and write by default.

-- ----------------------------------------------------------------------------
-- 6. create_public_booking — adds p_verification_token, server-side email
--    verification check, and sets email_verified/verified_at on insert.
-- ----------------------------------------------------------------------------
drop function if exists public.create_public_booking(uuid, date, date, int, text, text, text, text, text, text);

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
  p_email text default null,
  p_verification_token text default null
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
  v_email text;
  v_otp public.email_otp_verifications;
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
    raise exception 'Please enter a valid phone number';
  end if;

  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'At least 1 guest is required';
  end if;

  -- ---- email verification is required to create a booking ----
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'A verified email address is required to book';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if p_verification_token is null or length(trim(p_verification_token)) = 0 then
    raise exception 'Please verify your email address before booking';
  end if;

  select * into v_otp
  from public.email_otp_verifications
  where email = v_email
    and verification_token = p_verification_token
    and verified = true
    and verified_at is not null
    and verified_at > now() - interval '30 minutes'
  order by verified_at desc
  limit 1;

  if not found then
    raise exception 'Email verification failed. Please request a new verification code.';
  end if;

  -- ---- room + availability checks (unchanged) ----
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
    v_email,
    nullif(trim(coalesce(p_nationality, '')), ''),
    nullif(trim(coalesce(p_passport_number, '')), ''),
    p_guest_count,
    p_notes
  )
  returning id into v_guest_id;

  begin
    insert into public.bookings (
      guest_id, room_id, guest_count, check_in, check_out,
      total_amount, pricing_method, advance_paid, booking_source, payment_status, booking_status, notes,
      email_verified, phone_verified, verified_at
    ) values (
      v_guest_id, p_room_id, p_guest_count, p_check_in, p_check_out,
      v_price.total_amount, v_price.pricing_method, 0, 'website', 'unpaid', 'pending_approval', p_notes,
      true, false, v_otp.verified_at
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

grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text, text, text) to anon;
grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. approve_booking — body-only change, same signature. Now moves a
--    pending_approval request to 'payment_under_review' instead of
--    'confirmed'; the room is not reserved by this step any more.
-- ----------------------------------------------------------------------------
create or replace function public.approve_booking(p_booking_id uuid, p_device text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_staff_name text;
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

  update public.bookings
  set booking_status = 'payment_under_review',
      approved_at = now(),
      approved_by = auth.uid(),
      approved_by_name = v_staff_name
  where id = p_booking_id
  returning * into v_booking;

  -- No notification queued here on purpose — the guest already received the
  -- payment-instructions email immediately at submission time (see
  -- notify-new-booking). The next guest-facing email is the confirmation
  -- one, sent by approve_payment() once the advance payment is verified.

  return v_booking;
end;
$$;

grant execute on function public.approve_booking(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8a. approve_payment — the new room-reserving step. Moves
--     payment_under_review -> confirmed, records the verified advance as a
--     real transaction, and sends the existing "booking confirmed"
--     templates (moved here verbatim from the old approve_booking body).
-- ----------------------------------------------------------------------------
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
        E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nWe are pleased to inform you that your advance payment has been verified and your booking is now confirmed.\n\nBooking Number:\n%s\n\nRoom:\n%s\n\nBooking Confirmed On:\n%s\n\nCheck-in Date:\n%s\n\nCheck-out Date:\n%s\n\nTotal Amount:\nNPR %s\n\nAdvance Paid:\nNPR %s\n\nRemaining Balance (due at check-in):\nNPR %s\n\nPlease bring a valid government-issued identification document during check-in.\n\nIf you need assistance before your arrival, please contact us.\n\nThank you for choosing Jikmis Apartment.\n\nWe look forward to welcoming you.\n\nJikmis Apartment',
        coalesce(v_guest.full_name, 'Guest'),
        v_booking.booking_number,
        coalesce(v_room.room_number, ''),
        to_char(now(), 'YYYY-MM-DD'),
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

-- ----------------------------------------------------------------------------
-- 8b. reject_payment — payment_under_review -> rejected. Reuses the exact
--     existing rejection template/subject.
-- ----------------------------------------------------------------------------
create or replace function public.reject_payment(
  p_booking_id uuid,
  p_reason text,
  p_payment_screenshot_path text default null,
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
  v_staff_name text;
  v_message text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to reject payments';
  end if;

  if p_reason is null or length(trim(p_reason)) < 2 then
    raise exception 'A rejection reason is required';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'payment_under_review' then
    raise exception 'Only bookings awaiting payment review can be rejected here';
  end if;

  select full_name into v_staff_name from public.profiles where id = auth.uid();

  perform set_config('app.audit_device', coalesce(p_device, ''), true);

  update public.bookings
  set booking_status = 'rejected',
      rejected_at = now(),
      rejected_by = auth.uid(),
      rejected_by_name = v_staff_name,
      rejection_reason = trim(p_reason),
      payment_screenshot_path = coalesce(p_payment_screenshot_path, payment_screenshot_path)
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

grant execute on function public.reject_payment(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8c. request_new_payment_screenshot — stays in payment_under_review, just
--     clears the (presumably unclear/wrong) screenshot and asks the guest
--     to resend via WhatsApp.
-- ----------------------------------------------------------------------------
create or replace function public.request_new_payment_screenshot(
  p_booking_id uuid,
  p_note text default null,
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
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to update this booking';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'payment_under_review' then
    raise exception 'Only bookings awaiting payment review can be sent back for a new screenshot';
  end if;

  perform set_config('app.audit_device', coalesce(p_device, ''), true);

  update public.bookings
  set payment_screenshot_path = null,
      admin_notes = coalesce(p_note, admin_notes)
  where id = p_booking_id
  returning * into v_booking;

  select * into v_guest from public.guests where id = v_booking.guest_id;

  if v_guest.email is not null and length(trim(v_guest.email)) > 0 then
    insert into public.notification_log (booking_id, guest_id, channel, template, recipient, subject, message, status)
    values (
      p_booking_id,
      v_booking.guest_id,
      'email',
      'payment_screenshot_requested',
      trim(v_guest.email),
      'Action Needed – Payment Screenshot – Jikmis Apartment',
      format(
        E'Dear %s,\n\nGreetings from Jikmis Apartment.\n\nWe were unable to verify the payment screenshot for your booking.\n\nBooking Number:\n%s\n\n%s\n\nPlease resend a clear screenshot of your 50%% advance payment receipt via WhatsApp to +977 9708538395 so we can confirm your reservation.\n\nThank you for your patience.\n\nJikmis Apartment',
        coalesce(v_guest.full_name, 'Guest'),
        v_booking.booking_number,
        coalesce(nullif(trim(p_note), ''), 'Please make sure the amount, date, and recipient are clearly visible.')
      ),
      'pending'
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.request_new_payment_screenshot(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8d. admin_update_booking_note — freeform internal notes, any status.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_booking_note(p_booking_id uuid, p_note text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to update this booking';
  end if;

  update public.bookings
  set admin_notes = p_note
  where id = p_booking_id
  returning * into v_booking;

  if not found then
    raise exception 'Booking not found';
  end if;

  return v_booking;
end;
$$;

grant execute on function public.admin_update_booking_note(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. expire_stale_payment_reviews — opportunistic sweep, no cron available.
-- ----------------------------------------------------------------------------
create or replace function public.expire_stale_payment_reviews()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_active_staff() then
    return 0;
  end if;

  update public.bookings
  set booking_status = 'expired'
  where booking_source = 'website'
    and booking_status in ('pending_approval', 'payment_under_review')
    and payment_verified_at is null
    and created_at < now() - interval '24 hours';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_stale_payment_reviews() to authenticated;

-- ----------------------------------------------------------------------------
-- 10. log_audit_event — body-only change, same signature. Adds clear action
--     names for the new transitions; every existing case is untouched.
-- ----------------------------------------------------------------------------
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
  v_device text;
begin
  v_device := nullif(current_setting('app.audit_device', true), '');

  if TG_TABLE_NAME = 'transactions' then
    v_action := case when new.transaction_type = 'refund' then 'refund' else 'payment' end;
    v_booking_id := new.booking_id;
    v_details := jsonb_build_object('amount', new.amount, 'payment_method', new.payment_method, 'transaction_type', new.transaction_type);
  elsif TG_TABLE_NAME = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
    if TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'payment_under_review' then
      v_action := 'booking_approved';
      v_details := jsonb_build_object('booking_number', new.booking_number, 'approved_by_name', new.approved_by_name);
    elsif TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'rejected' then
      v_action := 'booking_rejected';
      v_details := jsonb_build_object(
        'booking_number', new.booking_number,
        'rejection_reason', new.rejection_reason,
        'rejected_by_name', new.rejected_by_name
      );
    elsif TG_OP = 'UPDATE' and old.booking_status = 'payment_under_review' and new.booking_status = 'confirmed' then
      v_action := 'payment_approved';
      v_details := jsonb_build_object(
        'booking_number', new.booking_number,
        'advance_paid', new.advance_paid,
        'payment_verified_by_name', new.payment_verified_by_name
      );
    elsif TG_OP = 'UPDATE' and old.booking_status = 'payment_under_review' and new.booking_status = 'rejected' then
      v_action := 'payment_rejected';
      v_details := jsonb_build_object(
        'booking_number', new.booking_number,
        'rejection_reason', new.rejection_reason,
        'rejected_by_name', new.rejected_by_name
      );
    elsif TG_OP = 'UPDATE' and old.booking_status != 'expired' and new.booking_status = 'expired' then
      v_action := 'booking_expired';
      v_details := jsonb_build_object('booking_number', new.booking_number);
    else
      v_action := 'booking_' || lower(TG_OP);
      v_details := jsonb_build_object('booking_number', coalesce(new.booking_number, old.booking_number));
    end if;
  elsif TG_OP = 'DELETE' then
    v_action := TG_TABLE_NAME || '_deleted';
    v_details := to_jsonb(old) - 'created_at' - 'updated_at';
  else
    v_action := TG_TABLE_NAME || '_' || lower(TG_OP);
    v_details := to_jsonb(new) - 'created_at' - 'updated_at';
  end if;

  if v_device is not null then
    v_details := v_details || jsonb_build_object('device', v_device);
  end if;

  insert into public.audit_logs (action, booking_id, performed_by, details)
  values (v_action, v_booking_id, auth.uid(), v_details);

  return coalesce(new, old);
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. payment-screenshots storage bucket — private, staff-only, same shape
--     as the existing guest-documents bucket.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do update set public = false;

drop policy if exists "payment_screenshots_staff_select" on storage.objects;
create policy "payment_screenshots_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_active_staff());

drop policy if exists "payment_screenshots_staff_insert" on storage.objects;
create policy "payment_screenshots_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-screenshots' and public.is_active_staff());

drop policy if exists "payment_screenshots_staff_update" on storage.objects;
create policy "payment_screenshots_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_active_staff());

drop policy if exists "payment_screenshots_staff_delete" on storage.objects;
create policy "payment_screenshots_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_active_staff());
