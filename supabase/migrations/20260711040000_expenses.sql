-- ============================================================================
-- Expense Management System
--
-- Adds: expense_categories, expenses, expense_reminders tables, plus a
-- private "expense-receipts" storage bucket for uploaded receipt images.
--
-- Permissions (matches the rest of the app's is_admin()/is_active_staff()
-- pattern, and the explicit rule the app owner set for this feature):
--   - Any active staff member can VIEW expenses, categories, and reminders.
--   - Only admins can add/edit/delete expenses, manage categories, and
--     add/edit/delete/complete reminders. This keeps all money-moving
--     actions admin-gated, enforced here in RLS (not just hidden in the UI),
--     the same way the rest of the app's financial tables work.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXPENSE CATEGORIES
-- ----------------------------------------------------------------------------
create table if not exists public.expense_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text unique not null,
  is_default   boolean not null default false,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

insert into public.expense_categories (name, is_default) values
  ('House Rent', true),
  ('Electricity Bill', true),
  ('Water Bill', true),
  ('Internet/WiFi Bill', true),
  ('Gas Bill', true),
  ('Maintenance & Repair', true),
  ('Cleaning Supplies', true),
  ('Laundry Expenses', true),
  ('Staff Salary', true),
  ('Food/Cafe Expenses', true),
  ('Marketing Expenses', true),
  ('Government Fees', true),
  ('Other Expenses', true)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- EXPENSES
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  category_id      uuid not null references public.expense_categories (id),
  amount           numeric(12, 2) not null check (amount >= 0),
  date             date not null default current_date,
  payment_method   text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'online_payment')),
  paid_by          text,
  description      text,
  receipt_url      text,
  status           text not null default 'paid' check (status in ('paid', 'pending')),
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_category on public.expenses (category_id);
create index if not exists idx_expenses_status on public.expenses (status);

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- EXPENSE REMINDERS (todo-style bill reminders)
-- ----------------------------------------------------------------------------
create table if not exists public.expense_reminders (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  due_date       date,
  amount         numeric(12, 2) check (amount >= 0),
  priority       text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  is_completed   boolean not null default false,
  completed_at   timestamptz,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_expense_reminders_due_date on public.expense_reminders (due_date);

create trigger trg_expense_reminders_updated_at
  before update on public.expense_reminders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_reminders enable row level security;

-- CATEGORIES: any active staff can read; only admin manages
create policy "expense_categories_select" on public.expense_categories for select using (public.is_active_staff());
create policy "expense_categories_insert" on public.expense_categories for insert with check (public.is_admin());
create policy "expense_categories_update" on public.expense_categories for update using (public.is_admin());
create policy "expense_categories_delete" on public.expense_categories for delete using (public.is_admin());

-- EXPENSES: any active staff can read; only admin adds/edits/deletes
create policy "expenses_select" on public.expenses for select using (public.is_active_staff());
create policy "expenses_insert" on public.expenses for insert with check (public.is_admin());
create policy "expenses_update" on public.expenses for update using (public.is_admin());
create policy "expenses_delete" on public.expenses for delete using (public.is_admin());

-- EXPENSE REMINDERS: any active staff can read; only admin manages
create policy "expense_reminders_select" on public.expense_reminders for select using (public.is_active_staff());
create policy "expense_reminders_insert" on public.expense_reminders for insert with check (public.is_admin());
create policy "expense_reminders_update" on public.expense_reminders for update using (public.is_admin());
create policy "expense_reminders_delete" on public.expense_reminders for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Storage: receipt images — private bucket, same pattern as guest-documents.
-- Staff can view (needed to check a receipt), only admins can upload/change/
-- remove one, matching the admin-only mutation rule above.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "expense_receipts_staff_select" on storage.objects;
create policy "expense_receipts_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'expense-receipts' and public.is_active_staff());

drop policy if exists "expense_receipts_admin_insert" on storage.objects;
create policy "expense_receipts_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts' and public.is_admin());

drop policy if exists "expense_receipts_admin_update" on storage.objects;
create policy "expense_receipts_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'expense-receipts' and public.is_admin());

drop policy if exists "expense_receipts_admin_delete" on storage.objects;
create policy "expense_receipts_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'expense-receipts' and public.is_admin());
