# Jikmis Apartment — Front Desk

A simple, fast reception booking & transaction management system built for a
receptionist to learn in under 10 minutes. Not a hotel PMS — just bookings,
guests, rooms, payments, and role-based staff accounts.

**Stack:** React + TypeScript + Vite + Tailwind CSS + React Router + React
Hook Form + Zod + Supabase (Postgres, Auth, Edge Functions). Deploy target:
Vercel.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, copy the **Project URL** and **anon public
   key**.
3. Install the Supabase CLI locally: `npm install -g supabase`.
4. Link this repo to your project:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

## 2. Run the database migrations

This creates every table (`profiles`, `guests`, `rooms`, `bookings`,
`transactions`), the double-booking guard, triggers, and row-level security
policies.

```bash
supabase db push
```

Optionally seed a few starter rooms:

```bash
psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/seed.sql
# or paste supabase/seed.sql into the Supabase SQL Editor
```

## 3. Deploy the two Edge Functions

Staff accounts (including the Super Admin) are created and managed through
Supabase Auth — **passwords are never stored in the database**, only Supabase
Auth's hashed credentials. These two Edge Functions are the only place the
service role key is used, and they check that the caller is an active admin
before doing anything.

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-manage-user
```

## 4. Create the Super Admin account

Do this once, from the Supabase Dashboard (not from a script, so the
password never touches source control):

1. Go to **Authentication → Users → Add user** in your Supabase Dashboard.
2. Email: e.g. `tsewangbista@jikmisapartment.com` — Password: choose a
   strong password (the brief's default of `admintsewang` is fine to start
   with, but change it before going live).
3. Under **User Metadata**, add:
   ```json
   { "full_name": "Tsewang Bista", "username": "tsewangbista", "role": "admin" }
   ```
4. Save. A trigger automatically creates the matching row in `profiles` with
   `role = admin`.
5. Log in to the app with that email + password — you'll land on the
   Dashboard with a **Settings & Staff** item in the sidebar.

From there, use **Settings & Staff → New Staff Account** to create your 4–5
receptionist logins. Only the admin account can see or use that page.

## 5. Configure and run the app locally

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Framework preset: **Vite**. Build command `npm run build`, output dir `dist`.
4. Add the same two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in Vercel's Project Settings → Environment
   Variables.
5. Deploy.

## Roles & permissions

| | Super Admin | Receptionist |
|---|---|---|
| Login, view dashboard, bookings, guests, rooms, transactions | ✅ | ✅ |
| Create bookings, add guests, record payments, check guests in/out | ✅ | ✅ |
| Edit a booking | ✅ (any) | ✅ (only ones they created) |
| Delete bookings / rooms / guests | ✅ | ❌ |
| Edit or delete transactions | ✅ | ❌ (can still create) |
| Create / disable / delete staff accounts, reset passwords | ✅ | ❌ |
| `/settings/users` (Settings & Staff) | ✅ | ❌ (redirected home) |

Enforcement is two layers deep: the UI hides admin-only actions from
receptionists, and Postgres Row Level Security enforces the same rules at the
database level (see `supabase/migrations/20260707000000_init.sql`), so it
can't be bypassed by calling the API directly.

## Database schema

- **profiles** — one row per login (admin or receptionist), linked 1:1 to
  Supabase Auth's `auth.users`. This *is* the "Users" table from the spec;
  there's no separate password column because Supabase Auth owns and hashes
  credentials.
- **guests** — full name, phone, nationality, passport/ID, guest count.
- **rooms** — room number, type, price, status (available / occupied /
  cleaning / maintenance).
- **bookings** — guest + room + dates; `nights` and `remaining_balance` are
  Postgres *generated columns* (always correct, can't drift); a `daterange`
  exclusion constraint blocks double-booking the same room automatically.
- **transactions** — every payment against a booking (advance, partial,
  final, refund), with method and timestamp.

## What's in v1

Dashboard stats, new booking flow (guest reuse, auto price/nights/balance,
double-booking prevention), bookings list (search/sort/filter/paginate,
view/edit/checkout/delete, CSV export, printable invoice), guest profiles
with visit history, room management, transactions with date/method filters
and CSV export, and admin staff management.

## Suggested v2+

Dark mode, WhatsApp booking automation, richer reports/analytics, and the
planned Jikmis Café module — deliberately left out of v1 to keep the app
something a receptionist can learn in ten minutes.
