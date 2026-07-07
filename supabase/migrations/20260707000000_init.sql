-- ============================================================================
-- Jikmis Apartment — Reception Booking & Transaction Management System
-- Initial schema, triggers, and row-level security policies
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES  (extends auth.users — this IS the "Users" table.
-- Supabase Auth stores/encrypts the password; we never store passwords here.)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null,
  username     text unique not null,
  phone        text,
  role         text not null default 'receptionist' check (role in ('admin', 'receptionist')),
  status       text not null default 'active' check (status in ('active', 'disabled')),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- GUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.guests (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  phone            text,
  nationality      text,
  passport_number  text,
  guest_count      int not null default 1,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ROOMS
-- ----------------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  room_number  text unique not null,
  room_type    text not null,
  price        numeric(12, 2) not null default 0,
  status       text not null default 'available' check (status in ('available', 'occupied', 'cleaning', 'maintenance')),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- BOOKINGS
-- ----------------------------------------------------------------------------
create sequence if not exists public.booking_number_seq start 1;

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  booking_number     text unique not null default ('JK-' || lpad(nextval('public.booking_number_seq')::text, 5, '0')),
  guest_id           uuid not null references public.guests (id),
  room_id            uuid not null references public.rooms (id),
  guest_count        int not null default 1,
  check_in           date not null,
  check_out          date not null,
  nights             int generated always as (greatest((check_out - check_in), 0)) stored,
  total_amount       numeric(12, 2) not null default 0,
  advance_paid       numeric(12, 2) not null default 0,
  remaining_balance  numeric(12, 2) generated always as (total_amount - advance_paid) stored,
  booking_source     text not null default 'walk_in' check (booking_source in ('walk_in', 'phone', 'whatsapp', 'website', 'booking_com', 'airbnb')),
  payment_method     text check (payment_method in ('cash', 'esewa', 'khalti', 'bank_transfer')),
  payment_status     text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  booking_status     text not null default 'confirmed' check (booking_status in ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  notes              text,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_dates check (check_out > check_in)
);

create index if not exists idx_bookings_guest on public.bookings (guest_id);
create index if not exists idx_bookings_room on public.bookings (room_id);
create index if not exists idx_bookings_status on public.bookings (booking_status);
create index if not exists idx_bookings_dates on public.bookings (check_in, check_out);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  guest_id          uuid references public.guests (id),
  amount            numeric(12, 2) not null check (amount >= 0),
  payment_method    text not null check (payment_method in ('cash', 'esewa', 'khalti', 'bank_transfer')),
  transaction_type  text not null default 'advance' check (transaction_type in ('advance', 'partial', 'final', 'refund')),
  notes             text,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_transactions_booking on public.transactions (booking_id);
create index if not exists idx_transactions_created_at on public.transactions (created_at);

-- ----------------------------------------------------------------------------
-- Prevent double-booking the same room over overlapping date ranges
-- ----------------------------------------------------------------------------
create extension if not exists "btree_gist";

alter table public.bookings
  add constraint no_overlapping_room_bookings
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (booking_status in ('confirmed', 'checked_in'));

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user is created
-- (used by the admin-create-user edge function, which sets user_metadata)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, phone, role, status, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'receptionist'),
    'active',
    nullif(new.raw_user_meta_data ->> 'created_by', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.guests enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.transactions enable row level security;

-- PROFILES: everyone active can read the staff directory; only admins write
create policy "profiles_select_staff" on public.profiles for select
  using (public.is_active_staff());
create policy "profiles_self_update" on public.profiles for update
  using (id = auth.uid());
create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- GUESTS: any active staff can read/write; only admin deletes
create policy "guests_select" on public.guests for select using (public.is_active_staff());
create policy "guests_insert" on public.guests for insert with check (public.is_active_staff());
create policy "guests_update" on public.guests for update using (public.is_active_staff());
create policy "guests_delete" on public.guests for delete using (public.is_admin());

-- ROOMS: any active staff can read; only admin manages
create policy "rooms_select" on public.rooms for select using (public.is_active_staff());
create policy "rooms_write" on public.rooms for insert with check (public.is_active_staff());
create policy "rooms_update" on public.rooms for update using (public.is_active_staff());
create policy "rooms_delete" on public.rooms for delete using (public.is_admin());

-- BOOKINGS: any active staff can read/create; own bookings (or admin) can be updated; only admin deletes
create policy "bookings_select" on public.bookings for select using (public.is_active_staff());
create policy "bookings_insert" on public.bookings for insert with check (public.is_active_staff());
create policy "bookings_update" on public.bookings for update
  using (public.is_admin() or created_by = auth.uid());
create policy "bookings_delete" on public.bookings for delete using (public.is_admin());

-- TRANSACTIONS: any active staff can read/create; only admin edits/deletes financial records
create policy "transactions_select" on public.transactions for select using (public.is_active_staff());
create policy "transactions_insert" on public.transactions for insert with check (public.is_active_staff());
create policy "transactions_update" on public.transactions for update using (public.is_admin());
create policy "transactions_delete" on public.transactions for delete using (public.is_admin());
