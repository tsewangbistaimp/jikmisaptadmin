-- ============================================================================
-- Manual Booking Approval, Guest Notification Service & Pending-Non-Blocking
-- Availability
--
-- Purely additive on top of the existing approval-workflow migrations
-- (20260801080000, 20260801090000). Nothing here removes or renames any
-- existing table/column/function; every change either adds a new column
-- (with a default, so existing rows are unaffected), adds a new function, or
-- re-creates a function body while keeping it behaving the same for every
-- caller that isn't specifically opting into the new behavior.
--
--   1. bookings: approved_by_name / rejected_by_name — a snapshot of the
--      staff member's display name at the moment of the action, so history
--      reads correctly even if that staff member's profile name changes
--      later or their account is disabled.
--   2. guests: email (nullable) — not collected by any booking form today,
--      but the column is ready the moment an email notification channel is
--      wired up, without yet another migration.
--   3. create_public_booking(): the pending-vs-pending overlap guard added
--      in 20260801090000 is REMOVED. Per updated product direction, a
--      still-pending request must never block another guest from requesting
--      the same dates — only a truly CONFIRMED (or checked-in) booking
--      reserves a room. Staff resolve overlapping pending requests by
--      approving one; the exclusion constraint + approve_booking()'s
--      existing exception handling already prevent double-confirming.
--   4. notification_log: widened into a proper outbox — guest_id, provider,
--      failure_reason, retry_count, and a 'retrying' status, so the admin
--      dashboard can show a real status badge and let staff retry a failed
--      send once a real SMS/WhatsApp/Email provider is configured.
--   5. approve_booking() / reject_booking(): re-created (adding an optional
--      p_device parameter, which is why they're dropped and re-created
--      rather than CREATE OR REPLACE'd — Postgres treats an appended
--      parameter as a different signature) to snapshot the staff member's
--      name, render the exact new guest-facing message templates, and
--      record an optional device string on the resulting audit log entry
--      via a transaction-local session setting (no new audit_logs column
--      needed).
--   6. update_notification_status() / retry_notification() — the only way
--      the admin dashboard's NotificationService is allowed to mark a
--      notification sent/failed or bump its retry count; every change is
--      also written to audit_logs.
--   7. get_room_booked_ranges() / get_rooms_availability_badges() — SECURITY
--      DEFINER, granted to anon. IMPORTANT FIX: public.bookings has never
--      had an anon SELECT policy (only the staff-only `bookings_select`
--      policy from init.sql), so the guest website's calendar and
--      availability checks — which query `bookings` directly — have always
--      silently received an EMPTY result set for anonymous visitors and
--      shown every date as available regardless of real bookings. Rather
--      than widen RLS on the whole table (which would also expose guest
--      names, phone numbers, totals, and notes to anonymous requests), these
--      two functions expose only the minimal fields a public calendar/room
--      card needs, for confirmed/checked-in bookings only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 & 2. New columns
-- ----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists approved_by_name text,
  add column if not exists rejected_by_name text;

alter table public.guests
  add column if not exists email text;

-- ----------------------------------------------------------------------------
-- 3. create_public_booking — drop the pending-vs-pending conflict guard.
--    Same signature/return columns as 20260801090000's version, so a plain
--    CREATE OR REPLACE is enough (no drop required).
-- ----------------------------------------------------------------------------
create or replace function public.create_public_booking(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_full_name text,
  p_phone text,
  p_nationality text default null,
  p_passport_number text default null,
  p_notes text default null
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

  -- Only a CONFIRMED/checked-in booking blocks a new request. A still-
  -- pending request from another guest for the same dates does NOT block —
  -- staff pick which one (if any) to approve.
  if exists (
    select 1 from public.bookings b
    where b.room_id = p_room_id
      and b.booking_status in ('confirmed', 'checked_in')
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'This room is no longer available for the selected dates';
  end if;

  select * into v_price from public.calculate_booking_price(p_room_id, p_check_in, p_check_out);

  insert into public.guests (full_name, phone, nationality, passport_number, guest_count, notes)
  values (
    trim(p_full_name),
    trim(p_phone),
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

grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text) to anon;
grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. notification_log — widen into a full outbox with retry support.
-- ----------------------------------------------------------------------------
alter table public.notification_log
  add column if not exists guest_id uuid references public.guests (id) on delete set null,
  add column if not exists provider text,
  add column if not exists failure_reason text,
  add column if not exists retry_count int not null default 0;

alter table public.notification_log drop constraint if exists notification_log_status_check;
alter table public.notification_log add constraint notification_log_status_check
  check (status in ('pending', 'sent', 'failed', 'retrying'));

-- ----------------------------------------------------------------------------
-- 5. approve_booking / reject_booking — re-created with an optional device
--    string (for the audit trail) and the exact new guest-facing templates.
--    Dropped first because adding a parameter is a new signature, not a
--    replacement, in Postgres's eyes.
-- ----------------------------------------------------------------------------
drop function if exists public.approve_booking(uuid);
drop function if exists public.reject_booking(uuid, text);

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
  v_notification_id uuid;
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

  -- Read by log_audit_event() below (via current_setting) so the resulting
  -- audit_logs row can carry an optional device string without a new column.
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
  values (p_booking_id, v_booking.guest_id, 'sms', 'booking_approved', coalesce(v_guest.phone, ''), v_message, 'pending')
  returning id into v_notification_id;

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

  return v_booking;
end;
$$;

grant execute on function public.reject_booking(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- log_audit_event — re-created (same signature) so any of the tables it
-- already watches can optionally carry a 'device' key in details, read from
-- the transaction-local setting approve_booking/reject_booking populate
-- above. Every other trigger call site is unaffected (current_setting with
-- missing_ok=true just returns null when nothing set it).
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
    if TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'confirmed' then
      v_action := 'booking_approved';
      v_details := jsonb_build_object(
        'booking_number', new.booking_number,
        'total_amount', new.total_amount,
        'pricing_method', new.pricing_method,
        'approved_by_name', new.approved_by_name
      );
    elsif TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'rejected' then
      v_action := 'booking_rejected';
      v_details := jsonb_build_object(
        'booking_number', new.booking_number,
        'rejection_reason', new.rejection_reason,
        'rejected_by_name', new.rejected_by_name
      );
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
-- 6. update_notification_status / retry_notification — the only writes
--    the admin dashboard's NotificationService is allowed to make to
--    notification_log. Both are staff-only and both leave an audit trail.
-- ----------------------------------------------------------------------------
create or replace function public.update_notification_status(
  p_notification_id uuid,
  p_status text,
  p_provider text default null,
  p_failure_reason text default null
)
returns public.notification_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_log;
  v_action text;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to update notifications';
  end if;

  if p_status not in ('sent', 'failed') then
    raise exception 'Status must be sent or failed';
  end if;

  update public.notification_log
  set status = p_status,
      provider = coalesce(p_provider, provider),
      failure_reason = case when p_status = 'sent' then null else p_failure_reason end,
      sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_notification_id
  returning * into v_row;

  if not found then
    raise exception 'Notification not found';
  end if;

  v_action := case when p_status = 'sent' then 'notification_sent' else 'notification_failed' end;

  insert into public.audit_logs (action, booking_id, performed_by, details)
  values (
    v_action,
    v_row.booking_id,
    auth.uid(),
    jsonb_build_object('channel', v_row.channel, 'recipient', v_row.recipient, 'provider', v_row.provider, 'failure_reason', v_row.failure_reason)
  );

  return v_row;
end;
$$;

grant execute on function public.update_notification_status(uuid, text, text, text) to authenticated;

create or replace function public.retry_notification(p_notification_id uuid)
returns public.notification_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_log;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to retry notifications';
  end if;

  update public.notification_log
  set status = 'retrying',
      retry_count = retry_count + 1
  where id = p_notification_id
  returning * into v_row;

  if not found then
    raise exception 'Notification not found';
  end if;

  insert into public.audit_logs (action, booking_id, performed_by, details)
  values (
    'notification_retry',
    v_row.booking_id,
    auth.uid(),
    jsonb_build_object('channel', v_row.channel, 'recipient', v_row.recipient, 'retry_count', v_row.retry_count)
  );

  return v_row;
end;
$$;

grant execute on function public.retry_notification(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Public, minimal-column availability reads for the guest website —
--    fixes the anon-can-never-see-bookings gap described above.
-- ----------------------------------------------------------------------------
create or replace function public.get_room_booked_ranges(p_room_id uuid, p_from date, p_to date)
returns table (check_in date, check_out date)
language sql
stable
security definer
set search_path = public
as $$
  select b.check_in, b.check_out
  from public.bookings b
  where b.room_id = p_room_id
    and b.booking_status in ('confirmed', 'checked_in')
    and b.check_in < p_to
    and b.check_out > p_from;
$$;

grant execute on function public.get_room_booked_ranges(uuid, date, date) to anon;
grant execute on function public.get_room_booked_ranges(uuid, date, date) to authenticated;

create or replace function public.is_room_range_available(p_room_id uuid, p_check_in date, p_check_out date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.bookings b
    where b.room_id = p_room_id
      and b.booking_status in ('confirmed', 'checked_in')
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  );
$$;

grant execute on function public.is_room_range_available(uuid, date, date) to anon;
grant execute on function public.is_room_range_available(uuid, date, date) to authenticated;

-- Per-room availability badge over a rolling window (default 14 days),
-- based on how many of those days are covered by a confirmed/checked-in
-- booking. Bookings for the same room never overlap each other (the
-- no_overlapping_room_bookings exclusion constraint guarantees it for
-- confirmed/checked_in rows), so summing each overlapping booking's
-- in-window length is safe and never double-counts a day.
create or replace function public.get_rooms_availability_badges(p_days int default 14)
returns table (room_id uuid, badge text)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    case
      when r.status = 'maintenance' then 'full'
      when coalesce(sum(
        greatest(0, least(b.check_out, current_date + p_days) - greatest(b.check_in, current_date))
      ), 0) <= 0 then 'available'
      when coalesce(sum(
        greatest(0, least(b.check_out, current_date + p_days) - greatest(b.check_in, current_date))
      ), 0) >= p_days then 'full'
      else 'limited'
    end as badge
  from public.rooms r
  left join public.bookings b
    on b.room_id = r.id
    and b.booking_status in ('confirmed', 'checked_in')
    and b.check_in < current_date + p_days
    and b.check_out > current_date
  group by r.id, r.status;
$$;

grant execute on function public.get_rooms_availability_badges(int) to anon;
grant execute on function public.get_rooms_availability_badges(int) to authenticated;
