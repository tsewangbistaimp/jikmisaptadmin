-- ============================================================================
-- Expense Improvements: per-category monthly budgets + recurring reminders
--
-- Adds two independent, additive features to the existing expense module
-- (does not touch any existing table/column/policy):
--
--   1. Budget per category — expense_categories.monthly_budget. Nullable:
--      null means "no budget set for this category", which the UI treats
--      as "don't show a Budget vs Actual bar for it" rather than 0 (a
--      category admins haven't budgeted for yet shouldn't look like it's
--      already over-budget).
--
--   2. Recurring reminders — expense_reminders.is_recurring +
--      recurrence_interval. When a recurring reminder is completed, the
--      client creates the next occurrence (due_date advanced by the
--      interval) rather than the DB auto-generating it, matching this
--      table's existing pattern of being a plain client-managed todo list
--      (no trigger/function currently writes to it either).
-- ============================================================================

alter table public.expense_categories
  add column if not exists monthly_budget numeric(12, 2) check (monthly_budget is null or monthly_budget >= 0);

alter table public.expense_reminders
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval text check (recurrence_interval in ('weekly', 'monthly', 'yearly'));
