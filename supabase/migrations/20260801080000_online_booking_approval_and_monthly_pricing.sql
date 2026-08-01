-- ============================================================================
-- Online Booking Approval Workflow + Automatic Long-Term (Monthly) Pricing
--
-- This migration is purely ADDITIVE on top of the existing schema (init.sql,
-- payments_and_auth_codes.sql, public_booking_website.sql, etc.). It does not
-- drop or rename any existing table/column/function, and every existing
-- staff/reception booking flow keeps working exactly as before — the only
-- behavior change is that bookings created from the public website now land
-- as 'pending_approval' instead of 'confirmed', and everyone (website +
-- admin dashboard) now shares one server-side pricing engine.
--
-- Contents:
--   1. pricing_config / pricing_settings — small, admin-editable config
--      tables so the "30 nights" long-stay threshold and the three monthly
--      apartment rates are never hardcoded in application code.
--   2. calculate_booking_price() — the ONE place daily-vs-monthly pricing is
--      decided. Both the guest website and the admin dashboard call this via
--      RPC for live previews, and it's used internally below wherever a
--      booking's price must be authoritatively computed.
--   3. bookings table: new columns for the approval workflow
--      (pricing_method, approved_at/by, rejected_at/by, rejection_reason)
--      and an updated booking_status check constraint that adds
--      'pending_approval' and 'rejected' alongside the existing statuses.
--   4. create_public_booking() is redefined (same signature) to price itself
--      via calculate_booking_price() and to land as 'pending_approval'
--      rather than 'confirmed' — guest bookings now require staff approval.
--   5. approve_booking() / reject_booking() — the only way a pending
--      request becomes 'confirmed' or 'rejected'. Approving relies on the
--      pre-existing no_overlapping_room_bookings exclusion constraint (still
--      scoped to confirmed/checked_in) to reject an approval that would
--      double-book a room, exactly the same guarantee reception bookings
--      already get.
--   6. modify_booking_stay() — lets staff change a booking's room/dates
--      (e.g. while reviewing an online request) with the total automatically
--      recalculated by the same shared engine.
--   7. notification_log — records the exact guest-approval/rejection message
--      that should be sent (matching the templates product asked for). No
--      email/SMS/WhatsApp provider is configured yet, so nothing is actually
--      dispatched from here; this just keeps the architecture ready for a
--      future Edge Function (or similar) to pick up 'pending' rows and send
--      them once a provider is wired up.
--   8. log_audit_event() is redefined to label approvals/rejections
--      distinctly ('booking_approved' / 'booking_rejected') instead of the
--      generic 'booking_update', reusing the exact same trigger already
--      installed on public.bookings — no new trigger needed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configurable pricing settings
-- ----------------------------------------------------------------------------
create table if not exists public.pricing_config (
  id                         boolean primary key default true check (id),
  long_stay_threshold_nights int not null default 30 check (long_stay_threshold_nights > 0),
  updated_at                 timestamptz not null default now()
);

insert into public.pricing_config (id, long_stay_threshold_nights)
values (true, 30)
on conflict (id) do nothing;

create table if not exists public.pricing_settings (
  room_type_key text primary key check (room_type_key in ('single', 'double', 'family')),
  monthly_rate  numeric(12, 2) not null default 0 check (monthly_rate >= 0),
  updated_at    timestamptz not null default now()
);

insert into public.pricing_settings (room_type_key, monthly_rate) values
  ('single', 35000),
  ('double', 45000),
  ('family', 65000)
on conflict (room_type_key) do nothing;

alter table public.pricing_config enable row level security;
alter table public.pricing_settings enable row level security;

drop policy if exists "pricing_config_select_staff" on public.pricing_config;
create policy "pricing_config_select_staff" on public.pricing_config for select using (public.is_active_staff());
drop policy if exists "pricing_config_admin_write" on public.pricing_config;
create policy "pricing_config_admin_write" on public.pricing_config for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pricing_settings_select_staff" on public.pricing_settings;
create policy "pricing_settings_select_staff" on public.pricing_settings for select using (public.is_active_staff());
drop policy if exists "pricing_settings_admin_write" on public.pricing_settings;
create policy "pricing_settings_admin_write" on public.pricing_settings for update using (public.is_admin()) with check (public.is_admin());

create trigger trg_pricing_config_updated_at
  before update on public.pricing_config
  for each row execute function public.set_updated_at();

create trigger trg_pricing_settings_updated_at
  before update on public.pricing_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. calculate_booking_price — the single shared pricing engine
--
-- Room-type matching mirrors the exact substring rule the guest website
-- already uses client-side (getRoomTypeKey in jikmis-website/src/data/
-- content.ts: "single" / "double" / "family" or "2bhk"), so a room typed as
-- e.g. "Single Studio" or "2BHK Family Room" resolves to the same key here
-- and there.
--
-- SECURITY DEFINER + granted to anon so the logged-out website can get a
-- live quote without needing direct SELECT access to pricing_settings.
-- ----------------------------------------------------------------------------
create or replace function public.calculate_booking_price(
  p_room_id uuid,
  p_check_in date,
  p_check_out date
)
returns table (
  nights         int,
  pricing_method text,
  daily_rate     numeric,
  monthly_rate   numeric,
  total_amount   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_nights int;
  v_key text;
  v_monthly numeric;
  v_threshold int;
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'A valid check-in and check-out date are required';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Selected room could not be found';
  end if;

  v_nights := p_check_out - p_check_in;

  select c.long_stay_threshold_nights into v_threshold from public.pricing_config c limit 1;
  v_threshold := coalesce(v_threshold, 30);

  v_key := case
    when lower(v_room.room_type) like '%family%' or lower(v_room.room_type) like '%2bhk%' then 'family'
    when lower(v_room.room_type) like '%double%' then 'double'
    when lower(v_room.room_type) like '%single%' then 'single'
    else null
  end;

  if v_key is not null then
    select s.monthly_rate into v_monthly from public.pricing_settings s where s.room_type_key = v_key;
  end if;

  if v_nights >= v_threshold and v_monthly is not null then
    return query select v_nights, 'monthly'::text, v_room.price, v_monthly, v_monthly;
  else
    return query select v_nights, 'daily'::text, v_room.price, v_monthly, v_room.price * v_nights;
  end if;
end;
$$;

grant execute on function public.calculate_booking_price(uuid, date, date) to anon;
grant execute on function public.calculate_booking_price(uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. bookings: approval-workflow columns + widened status constraint
-- ----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists pricing_method text check (pricing_method in ('daily', 'monthly')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles (id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles (id),
  add column if not exists rejection_reason text;

alter table public.bookings drop constraint if exists bookings_booking_status_check;
alter table public.bookings add constraint bookings_booking_status_check
  check (booking_status in ('pending_approval', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'rejected'));

-- Note: no_overlapping_room_bookings (init.sql) already only guards
-- 'confirmed'/'checked_in' rows, so multiple 'pending_approval' requests for
-- overlapping dates can coexist by design — staff resolve the conflict when
-- approving (see approve_booking() below), the same way a front desk would
-- field two phone calls for the same room and pick one.

-- ----------------------------------------------------------------------------
-- 4. create_public_booking — now prices via the shared engine and lands as
--    'pending_approval' instead of auto-confirming.
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
  -- ---- validation (mirrors the existing staff-side zod rules) ----
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

  -- ---- room + availability checks ----
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

  -- ---- price via the shared engine (daily rate, or monthly rate at >= threshold nights) ----
  select * into v_price from public.calculate_booking_price(p_room_id, p_check_in, p_check_out);

  -- ---- create guest (snapshot of what the guest entered) ----
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

  -- ---- create booking; price computed above, never trusted from the client ----
  -- Lands as 'pending_approval' — the public site no longer auto-confirms.
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
-- 5. approve_booking / reject_booking — staff-only, the only way a pending
--    online request changes status.
-- ----------------------------------------------------------------------------
create or replace function public.approve_booking(p_booking_id uuid)
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
    raise exception 'Not authorized to approve bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status != 'pending_approval' then
    raise exception 'Only pending bookings can be approved';
  end if;

  begin
    update public.bookings
    set booking_status = 'confirmed',
        approved_at = now(),
        approved_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'This room is already booked for overlapping dates by another confirmed booking. Reject or modify this request instead.';
  end;

  select * into v_guest from public.guests where id = v_booking.guest_id;

  insert into public.notification_log (booking_id, channel, template, recipient, message)
  values (
    p_booking_id,
    'email',
    'booking_approved',
    coalesce(v_guest.phone, ''),
    format(
      E'Hello %s,\n\nYour booking request has been approved.\n\nBooking Number: %s\nPricing Method: %s\nCheck-In: %s\nCheck-Out: %s\nTotal Amount: %s\n\nWe look forward to welcoming you to Jikmis Apartment.',
      coalesce(v_guest.full_name, 'Guest'),
      v_booking.booking_number,
      case v_booking.pricing_method when 'monthly' then 'Monthly Apartment Rate' else 'Daily Rate' end,
      v_booking.check_in::text,
      v_booking.check_out::text,
      v_booking.total_amount::text
    )
  );

  return v_booking;
end;
$$;

grant execute on function public.approve_booking(uuid) to authenticated;

create or replace function public.reject_booking(p_booking_id uuid, p_reason text)
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

  update public.bookings
  set booking_status = 'rejected',
      rejected_at = now(),
      rejected_by = auth.uid(),
      rejection_reason = trim(p_reason)
  where id = p_booking_id
  returning * into v_booking;

  select * into v_guest from public.guests where id = v_booking.guest_id;

  insert into public.notification_log (booking_id, channel, template, recipient, message)
  values (
    p_booking_id,
    'email',
    'booking_rejected',
    coalesce(v_guest.phone, ''),
    format(
      E'Hello %s,\n\nThank you for choosing Jikmis Apartment.\n\nUnfortunately, your booking request could not be approved.\n\nReason: %s\n\nPlease choose another room or different dates, or contact us for assistance.',
      coalesce(v_guest.full_name, 'Guest'),
      v_booking.rejection_reason
    )
  );

  return v_booking;
end;
$$;

grant execute on function public.reject_booking(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. modify_booking_stay — staff changes room/check-in/check-out on a
--    booking (typically a pending online request); total is always
--    recomputed by the same shared pricing engine, never hand-typed.
-- ----------------------------------------------------------------------------
create or replace function public.modify_booking_stay(
  p_booking_id uuid,
  p_room_id uuid,
  p_check_in date,
  p_check_out date
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_price record;
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized to modify bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.booking_status in ('checked_out', 'cancelled', 'rejected') then
    raise exception 'Cannot modify a % booking', v_booking.booking_status;
  end if;

  select * into v_price from public.calculate_booking_price(p_room_id, p_check_in, p_check_out);

  begin
    update public.bookings
    set room_id = p_room_id,
        check_in = p_check_in,
        check_out = p_check_out,
        pricing_method = v_price.pricing_method,
        total_amount = v_price.total_amount
    where id = p_booking_id
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'That room is already booked for overlapping dates.';
  end;

  return v_booking;
end;
$$;

grant execute on function public.modify_booking_stay(uuid, uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. notification_log — reusable, provider-agnostic outbox for guest
--    notifications. No email/SMS/WhatsApp provider is wired up yet; rows are
--    written here (by approve_booking/reject_booking above) with 'pending'
--    status so a future Edge Function (or similar) can pick them up and mark
--    them 'sent'/'failed' once a provider is configured, without touching
--    any of the code that already exists.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings (id) on delete set null,
  channel     text not null check (channel in ('email', 'whatsapp', 'sms')),
  template    text not null check (template in ('booking_approved', 'booking_rejected')),
  recipient   text,
  message     text not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notification_log_status on public.notification_log (status);

alter table public.notification_log enable row level security;

drop policy if exists "notification_log_select_staff" on public.notification_log;
create policy "notification_log_select_staff" on public.notification_log for select using (public.is_active_staff());

-- No insert/update/delete policy for any client role — every row is written
-- exclusively by the SECURITY DEFINER functions above (or a future trusted
-- server-side sender), matching the audit_logs / auth_codes pattern already
-- used elsewhere in this schema.

-- ----------------------------------------------------------------------------
-- 8. Audit log: label approvals/rejections distinctly, reusing the existing
--    trg_audit_bookings trigger (no new trigger needed).
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
begin
  if TG_TABLE_NAME = 'transactions' then
    v_action := case when new.transaction_type = 'refund' then 'refund' else 'payment' end;
    v_booking_id := new.booking_id;
    v_details := jsonb_build_object('amount', new.amount, 'payment_method', new.payment_method, 'transaction_type', new.transaction_type);
  elsif TG_TABLE_NAME = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
    if TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'confirmed' then
      v_action := 'booking_approved';
      v_details := jsonb_build_object('booking_number', new.booking_number, 'total_amount', new.total_amount, 'pricing_method', new.pricing_method);
    elsif TG_OP = 'UPDATE' and old.booking_status = 'pending_approval' and new.booking_status = 'rejected' then
      v_action := 'booking_rejected';
      v_details := jsonb_build_object('booking_number', new.booking_number, 'rejection_reason', new.rejection_reason);
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

  insert into public.audit_logs (action, booking_id, performed_by, details)
  values (v_action, v_booking_id, auth.uid(), v_details);

  return coalesce(new, old);
end;
$$;
