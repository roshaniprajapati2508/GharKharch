-- GharKharch: SQL support for Phase 5 "Intelligence" (spec sections 11, 19, 27,
-- 80): weekday-affinity for the Quick Add scoring formula, and gap-consistency
-- for recurring-expense detection. Both need per-row date arithmetic (weekday
-- extraction, consecutive-purchase gaps) that the Phase 4 aggregate functions
-- don't compute, so they get their own STABLE SQL functions rather than
-- pulling raw expenses into the browser to calculate this in JS (spec
-- section 88).

-- ---------------------------------------------------------
-- Weekday affinity: for each item, what fraction of its purchases in the last
-- `p_lookback_days` fell on the given weekday (0 = Sunday .. 6 = Saturday).
-- Feeds the `weekdayPattern` term of the Quick Add score (spec section 80).
-- ---------------------------------------------------------
create or replace function public.get_item_weekday_affinity(
  p_household_id uuid,
  p_weekday int,
  p_lookback_days int default 120,
  p_min_txn int default 3
)
returns table (
  item_name text,
  weekday_txn_count bigint,
  total_txn_count bigint,
  affinity numeric
)
language sql
stable
as $$
  select
    lower(e.item_name) as item_name,
    count(*) filter (where extract(dow from e.expense_date) = p_weekday) as weekday_txn_count,
    count(*) as total_txn_count,
    round(
      count(*) filter (where extract(dow from e.expense_date) = p_weekday)::numeric
      / count(*),
      3
    ) as affinity
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date >= (current_date - p_lookback_days)
  group by lower(e.item_name)
  having count(*) >= p_min_txn
  order by affinity desc;
$$;

-- ---------------------------------------------------------
-- Gap consistency per item: average days between consecutive purchases, and
-- how much that gap varies (lower stddev = more consistent / recurring-like).
-- Feeds recurring-detector.ts (spec section 11: "Milk is usually added every
-- 1-2 days" style suggestions). Only ever a suggestion - nothing here writes
-- to `recurring_expenses` automatically.
-- ---------------------------------------------------------
create or replace function public.get_item_gap_consistency(
  p_household_id uuid,
  p_lookback_days int default 180,
  p_min_txn int default 4
)
returns table (
  item_name text,
  txn_count bigint,
  avg_gap_days numeric,
  gap_stddev_days numeric,
  last_date date,
  avg_amount numeric,
  merchant_id uuid,
  category_id uuid,
  subcategory_id uuid
)
language sql
stable
as $$
  with ordered as (
    select
      lower(e.item_name) as item_name,
      e.expense_date,
      e.amount,
      e.merchant_id,
      e.category_id,
      e.subcategory_id,
      e.expense_date - lag(e.expense_date) over (partition by lower(e.item_name) order by e.expense_date) as gap_days
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date >= (current_date - p_lookback_days)
  )
  select
    item_name,
    count(*) as txn_count,
    round(avg(gap_days), 1) as avg_gap_days,
    round(coalesce(stddev_samp(gap_days), 0), 1) as gap_stddev_days,
    max(expense_date) as last_date,
    round(avg(amount), 2) as avg_amount,
    mode() within group (order by merchant_id) as merchant_id,
    mode() within group (order by category_id) as category_id,
    mode() within group (order by subcategory_id) as subcategory_id
  from ordered
  group by item_name
  having count(*) >= p_min_txn and avg(gap_days) is not null
  order by gap_stddev_days asc, avg_gap_days asc;
$$;
