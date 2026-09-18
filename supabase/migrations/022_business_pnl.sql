-- GharKharch: Mini P&L for the Homemade Business (spec: "Mini P&L for
-- Homemade Business" feature - income vs. expense tracking with a net
-- profit widget).
--
-- Schema decision: a new `entry_type` column on `expenses` ('expense' |
-- 'income', default 'expense') rather than a separate `business_orders`
-- table. Reasoning: a sale is, mechanically, exactly the same shape as an
-- expense row (an amount, a date, a payment method, notes, who logged it) -
-- the only thing that differs is the direction the money moves. Reusing
-- `expenses` means every sale automatically gets the same edit/delete/undo/
-- receipt-attachment/search/analytics-filter machinery every expense
-- already has, with zero duplicated code, instead of maintaining a parallel
-- table and a parallel set of actions/components for it. `entry_type`
-- defaults to 'expense' so every existing row, and every non-business
-- entry going forward, is completely unaffected.
--
-- get_business_pnl() aggregates in Postgres (same rule as every other
-- analytics function in this project - never sum raw rows in the browser):
--   income_total  = sum of entry_type = 'income' rows in the period
--   expense_total = sum of entry_type = 'expense' rows whose category is
--                   the Homemade Business tree (matched by name, same
--                   convention as migration 021's business scope filter)
--   net_profit    = income_total - expense_total
-- UPDATED (still part of migration 022, not yet run - safe to edit in
-- place): originally income_total counted every entry_type = 'income' row
-- in the household, since at the time this was the ONLY way to log income
-- at all. Migration 023 adds general household income categories (Salary,
-- Freelancing & Consulting, Business Sales & Payouts), so that's no longer
-- true - a salary deposit must never count as this business's income. This
-- function now scopes income the same way it already scoped expense: the
-- Homemade Business category tree, OR the "Business Sales & Payouts"
-- category (income logged there even if not literally under Homemade
-- Business, e.g. a marketplace payout categorized before the household
-- reorganizes it).

alter table expenses
  add column if not exists entry_type text not null default 'expense'
  check (entry_type in ('expense', 'income'));

comment on column expenses.entry_type is
  'expense (default) or income - Mini P&L (migration 022). Only meaningful for Homemade Business rows; every other row stays ''expense''.';

create index if not exists idx_expenses_entry_type
  on expenses (household_id, entry_type, expense_date)
  where deleted_at is null;

create function public.get_business_pnl(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  income_total numeric,
  expense_total numeric,
  net_profit numeric,
  income_count bigint,
  expense_count bigint
)
language sql
stable
as $$
  with business_top as (
    select id from categories
    where name in ('Homemade Business', 'Business Sales & Payouts')
      and (household_id = p_household_id or household_id is null)
  ),
  scoped as (
    select e.*
    from expenses e
    join categories c on c.id = e.category_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
      and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
  )
  select
    coalesce(sum(amount) filter (where entry_type = 'income'), 0) as income_total,
    coalesce(sum(amount) filter (where entry_type = 'expense'), 0) as expense_total,
    coalesce(sum(amount) filter (where entry_type = 'income'), 0)
      - coalesce(sum(amount) filter (where entry_type = 'expense'), 0) as net_profit,
    count(*) filter (where entry_type = 'income') as income_count,
    count(*) filter (where entry_type = 'expense') as expense_count
  from scoped;
$$;

comment on function public.get_business_pnl is
  'Mini P&L for the Homemade Business (migration 022): income vs. business expense for a date range, aggregated in Postgres.';
