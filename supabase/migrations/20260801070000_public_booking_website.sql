-- ============================================================================
-- Public guest-booking website support
--
-- This migration is purely ADDITIVE — it does not alter, drop, or replace any
-- existing table, column, policy, or function. It only adds:
--
--   1. Two new RLS policies granting the `anon` role read-only access to
--      `rooms` and `services` (active ones only) — needed so a public,
--      logged-out website can list rooms/prices without any authentication.
--      Postgres RLS policies for the same command are combined with OR, so
--      this does not change or weaken the existing staff-only policies
--      (rooms_select, services_select) at all — it just adds a second,
--      narrower door for anonymous visitors.
--
--   2. One new SECURITY DEFINER function, create_public_booking(), which is
--      the ONLY way the public website is allowed to create a booking. It
--      deliberately does NOT grant `anon` direct INSERT on `guests` or
--      `bookings` (that would let a browser submit any total_amount it
--      wants). Instead this function:
--        - validates the guest/date input itself (mirrors the existing zod
--          rules used by the staff booking form: name >= 2 chars, phone >= 7
--          chars, check_out > check_in, no past check-in dates)
--        - checks the room isn't under maintenance and isn't already booked
--          for an overlapping range (defense in depth — the real guarantee
--          is still the existing `no_overlapping_room_bookings` exclusion
--          constraint from 20260707000000_init.sql, which this function's
--          insert still goes through and which it gracefully reports if it
--          fires on a race condition)
--        - computes total_amount itself from the room's real, current price
--          × nights — the client can never pass in its own amount
--        - always inserts booking_source = 'website', payment_status =
--          'unpaid', advance_paid = 0 (payment collection, if added later,
--          happens after this call, the same way record_payment() already
--          works for staff)
--        - returns just enough data for a confirmation screen
--
-- Because this function is SECURITY DEFINER, it runs with the privileges of
-- the function owner and bypasses RLS for its own inserts — so no INSERT
-- policy on guests/bookings for anon is needed or added.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Public read access for the booking website
-- ----------------------------------------------------------------------------
drop policy if exists "rooms_public_select" on public.rooms;
create policy "rooms_public_select" on public.rooms
  for select to anon
  using (true);

drop policy if exists "services_public_select" on public.services;
create policy "services_public_select" on public.services
  for select to anon
  using (status = 'active');

-- ----------------------------------------------------------------------------
-- 2. create_public_booking — the only public write path
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
  v_nights int;
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

  v_nights := p_check_out - p_check_in;

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

  -- ---- create booking; price computed here, never trusted from the client ----
  begin
    insert into public.bookings (
      guest_id, room_id, guest_count, check_in, check_out,
      total_amount, advance_paid, booking_source, payment_status, booking_status, notes
    ) values (
      v_guest_id, p_room_id, p_guest_count, p_check_in, p_check_out,
      v_room.price * v_nights, 0, 'website', 'unpaid', 'confirmed', p_notes
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
      v_booking.booking_status;
end;
$$;

-- Callable by a logged-out visitor (anon) and, harmlessly, by logged-in staff too.
grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text) to anon;
grant execute on function public.create_public_booking(uuid, date, date, int, text, text, text, text, text) to authenticated;
