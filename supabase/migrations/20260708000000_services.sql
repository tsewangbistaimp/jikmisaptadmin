-- ============================================================================
-- Services / add-ons (laundry, breakfast, airport pickup, etc.)
-- A manageable price list that can be attached to any booking.
-- ============================================================================

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  price       numeric(12, 2) not null default 0,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

create table if not exists public.booking_services (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  service_id  uuid references public.services (id) on delete set null,
  name        text not null,        -- snapshot of the service name at time of booking
  unit_price  numeric(12, 2) not null default 0,  -- snapshot of the price at time of booking
  quantity    int not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_booking_services_booking on public.booking_services (booking_id);

alter table public.services enable row level security;
alter table public.booking_services enable row level security;

-- SERVICES: any active staff can read; only admin manages the price list
create policy "services_select" on public.services for select using (public.is_active_staff());
create policy "services_insert" on public.services for insert with check (public.is_admin());
create policy "services_update" on public.services for update using (public.is_admin());
create policy "services_delete" on public.services for delete using (public.is_admin());

-- BOOKING_SERVICES: any active staff can attach/read; only admin deletes/edits after the fact
create policy "booking_services_select" on public.booking_services for select using (public.is_active_staff());
create policy "booking_services_insert" on public.booking_services for insert with check (public.is_active_staff());
create policy "booking_services_update" on public.booking_services for update using (public.is_admin());
create policy "booking_services_delete" on public.booking_services for delete using (public.is_admin());

-- Starter services
insert into public.services (name, price) values
  ('Laundry', 300),
  ('Breakfast', 250),
  ('Airport Pickup', 1200),
  ('Late Checkout', 500)
on conflict (name) do nothing;
