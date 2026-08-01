-- ============================================================================
-- Advanced long-term pricing (prorated monthly rate) + pending-request
-- conflict guard.
--
-- This migration is purely ADDITIVE/replacing-in-place on top of
-- 20260801080000_online_booking_approval_and_monthly_pricing.sql. It changes
-- two things:
--
--   1. calculate_booking_price() — stays of 30+ nights no longer charge one
--      flat monthly amount. Instead they charge a long-term DAILY rate
--      (monthly rate ÷ 30, rounded to 2 decimals) × the actual number of
--      nights, so a 35-night stay costs a bit more than a 30-night stay
--      instead of exactly the same. The RETURNS TABLE shape changes (a new
--      long_term_daily_rate column), so the function has to be dropped
--      before it's recreated — same reason the previous migration had to
--      drop create_public_booking().
--
--   2. create_public_booking() — the guest-facing availability check now
--      also treats an existing 'pending_approval' booking as blocking, not
--      just 'confirmed'/'checked_in'. Previously two guests could both
--      submit pending requests for overlapping dates; now the first pending
--      request reserves the dates until staff approve or reject it, so a
--      date already requested by someone else can never be requested again.
--      This function's signature/return shape is unchanged, so a plain
--      CREATE OR REPLACE is enough — no drop needed here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. calculate_booking_price — prorated long-term daily rate
--
-- Worked examples (matching the product spec exactly):
--   Single,  35 nights: 35000/30 = 1166.67 (rounded) × 35 = 40,833.45
--   Double,  45 nights: 45000/30 = 1500.00           × 45 = 67,500.00
--   Family,  60 nights: 65000/30 = 2166.67 (rounded) × 60 = 130,000.20
-- Note the daily rate is rounded to 2 decimals FIRST, then multiplied — that
-- intermediate rounding is what the spec's own numbers assume.
-- ----------------------------------------------------------------------------
drop function if exists public.calculate_booking_price(uuid, date, date);

create or replace function public.calculate_booking_price(
  p_room_id uuid,
  p_check_in date,
  p_check_out date
)
returns table (
  nights                int,
  pricing_method        text,
  daily_rate            numeric,
  monthly_rate          numeric,
  long_term_daily_rate  numeric,
  total_amount          numeric
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
  v_long_term_daily numeric;
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

  if v_monthly is not null then
    v_long_term_daily := round(v_monthly / 30.0, 2);
  end if;

  if v_nights >= v_threshold and v_long_term_daily is not null then
    return query select v_nights, 'monthly'::text, v_room.price, v_monthly, v_long_term_daily, v_long_term_daily * v_nights;
  else
    return query select v_nights, 'daily'::text, v_room.price, v_monthly, v_long_term_daily, v_room.price * v_nights;
  end if;
end;
$$;

grant execute on function public.calculate_booking_price(uuid, date, date) to anon;
grant execute on function public.calculate_booking_price(uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. create_public_booking — pending requests now also block new requests
--    for the same room/dates, matching the "pending approval dates must
--    automatically become unavailable" rule enforced client-side by the
--    booking calendar. Reception's own bookings are unaffected: staff still
--    create/edit bookings the same way they always have, and the hard
--    no_overlapping_room_bookings exclusion constraint (confirmed/checked_in
--    only) is untouched.
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

  if exists (
    select 1 from public.bookings b
    where b.room_id = p_room_id
      and b.booking_status = 'pending_approval'
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'These dates are already requested and awaiting administrator approval. Please choose another date.';
  end if;

  -- ---- price via the shared engine (daily rate, or prorated long-term daily rate x nights at >= threshold nights) ----
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
