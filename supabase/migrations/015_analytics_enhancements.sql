-- GharKharch: analytics enhancements closing gaps found by the "maximum
-- options" wishlist audit (spec sections 24-27, 8E). Same conventions as
-- 006_analytics_functions.sql: every function is SQL, STABLE, and runs with
-- the CALLER's privileges (Postgres default SECURITY INVOKER), so RLS on
-- `expenses` still applies even though p_household_id is also checked
-- defensively. Every function returns already-aggregated rows - never raw
-- expense sets.

-- ---------------------------------------------------------
-- Merchant analytics: add lowest_transaction (mirrors
-- get_category_breakdown's lowest_transaction) and share_pct (this
-- merchant's total as a % of the household's grand total for the period,
-- computed in one round trip via a CTE). Return column list changes, so this
-- must DROP + CREATE rather than CREATE OR REPLACE (Postgres refuses to
-- change a function's Returns columns in place).
-- ---------------------------------------------------------
drop function if exists public.get_merchant_breakdown(uuid, date, date, int);

create function public.get_merchant_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_limit int default 10
)
returns table (
  merchant_id uuid,
  merchant_name text,
  total numeric,
  txn_count bigint,
  avg_transaction numeric,
  highest_transaction numeric,
  lowest_transaction numeric,
  last_expense_date date,
  share_pct numeric
)
language sql
stable
as $$
  with scoped as (
    select e.*
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
  ),
  grand_total as (
    select coalesce(sum(amount), 0) as total from scoped
  )
  select
    m.id as merchant_id,
    m.name as merchant_name,
    coalesce(sum(e.amount), 0) as total,
    count(e.id) as txn_count,
    case when count(e.id) = 0 then 0 else round(sum(e.amount) / count(e.id), 2) end as avg_transaction,
    max(e.amount) as highest_transaction,
    min(e.amount) as lowest_transaction,
    max(e.expense_date) as last_expense_date,
    case when gt.total = 0 then 0 else round(coalesce(sum(e.amount), 0) / gt.total * 100, 2) end as share_pct
  from merchants m
  join scoped e on e.merchant_id = m.id
  cross join grand_total gt
  group by m.id, m.name, gt.total
  order by total desc
  limit p_limit;
$$;

-- ---------------------------------------------------------
-- Per-merchant monthly trend for a small sparkline (spec section 25).
-- Returns one row per month in the trailing p_months window (including
-- months with zero spend, so the sparkline has an even time axis).
-- ---------------------------------------------------------
create or replace function public.get_merchant_monthly_trend(
  p_household_id uuid,
  p_merchant_id uuid,
  p_months int default 6
)
returns table (
  month date,
  total numeric
)
language sql
stable
as $$
  with months as (
    select date_trunc('month', current_date)::date - (n || ' months')::interval as month
    from generate_series(0, greatest(p_months - 1, 0)) as n
  ),
  spend as (
    select date_trunc('month', e.expense_date)::date as month, sum(e.amount) as total
    from expenses e
    where e.household_id = p_household_id
      and e.merchant_id = p_merchant_id
      and e.deleted_at is null
      and e.expense_date >= (date_trunc('month', current_date) - (greatest(p_months - 1, 0) || ' months')::interval)::date
    group by date_trunc('month', e.expense_date)
  )
  select months.month::date as month, coalesce(spend.total, 0) as total
  from months
  left join spend on spend.month = months.month
  order by months.month;
$$;

-- ---------------------------------------------------------
-- Item analytics: add estimated_monthly_spend, a 30-day-normalized run rate
-- (spec section 26, 27). Return column list changes, so DROP + CREATE.
-- Guarded the same way avg_gap_days already guards against a tiny sample:
-- an item bought once, or a few times close together, floors the span at 1
-- day of "30-day rate" denominator rather than dividing by near-zero.
-- ---------------------------------------------------------
drop function if exists public.get_item_analytics(uuid, date, date, int);

create function public.get_item_analytics(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_limit int default 20
)
returns table (
  item_name text,
  txn_count bigint,
  total numeric,
  avg_amount numeric,
  first_date date,
  last_date date,
  avg_gap_days numeric,
  estimated_monthly_spend numeric
)
language sql
stable
as $$
  select
    lower(e.item_name) as item_name,
    count(*) as txn_count,
    coalesce(sum(e.amount), 0) as total,
    round(sum(e.amount) / count(*), 2) as avg_amount,
    min(e.expense_date) as first_date,
    max(e.expense_date) as last_date,
    case
      when count(*) > 1 then round((max(e.expense_date) - min(e.expense_date))::numeric / (count(*) - 1), 1)
      else null
    end as avg_gap_days,
    round(
      sum(e.amount) / greatest((max(e.expense_date) - min(e.expense_date))::numeric / 30.0, 1),
      2
    ) as estimated_monthly_spend
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by lower(e.item_name)
  order by txn_count desc, total desc
  limit p_limit;
$$;

-- ---------------------------------------------------------
-- Payment method breakdown (spec section 8, free-text expenses.payment_method
-- column, matches a payment_methods.name per migration 005 but is not a
-- fixed enum/FK).
-- ---------------------------------------------------------
create or replace function public.get_payment_method_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  payment_method text,
  total numeric,
  txn_count bigint,
  share_pct numeric
)
language sql
stable
as $$
  with scoped as (
    select e.*
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
  ),
  grand_total as (
    select coalesce(sum(amount), 0) as total from scoped
  )
  select
    coalesce(e.payment_method, 'Unspecified') as payment_method,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count,
    case when gt.total = 0 then 0 else round(coalesce(sum(e.amount), 0) / gt.total * 100, 2) end as share_pct
  from scoped e
  cross join grand_total gt
  group by coalesce(e.payment_method, 'Unspecified'), gt.total
  order by total desc;
$$;
