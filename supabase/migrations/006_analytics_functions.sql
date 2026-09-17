-- GharKharch: server-side analytics aggregation (spec sections 23-32, 50, 69)
-- All functions are SQL, STABLE, and run with the CALLER's privileges (Postgres
-- default is SECURITY INVOKER), so the existing RLS policy on `expenses` is
-- still enforced even though we also filter by p_household_id defensively.
-- Every one of these returns already-aggregated rows — never raw expense sets —
-- so the browser never has to sum thousands of transactions itself.

-- ---------------------------------------------------------
-- Overall summary for a period (spec section 7, 69)
-- ---------------------------------------------------------
create or replace function public.get_expense_summary(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null
)
returns table (
  total numeric,
  txn_count bigint,
  avg_transaction numeric,
  days int,
  largest_amount numeric,
  largest_expense_id uuid
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
      and (p_paid_by is null or e.paid_by = p_paid_by)
  )
  select
    coalesce(sum(amount), 0) as total,
    count(*) as txn_count,
    case when count(*) = 0 then 0 else round(coalesce(sum(amount), 0) / count(*), 2) end as avg_transaction,
    (p_end - p_start + 1) as days,
    (select amount from scoped order by amount desc limit 1) as largest_amount,
    (select id from scoped order by amount desc limit 1) as largest_expense_id
  from scoped;
$$;

-- ---------------------------------------------------------
-- Category breakdown, includes both top-level and subcategory rows
-- (spec section 8B, 24)
-- ---------------------------------------------------------
create or replace function public.get_category_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null
)
returns table (
  category_id uuid,
  category_name text,
  icon text,
  color text,
  parent_id uuid,
  total numeric,
  txn_count bigint,
  avg_transaction numeric,
  highest_transaction numeric,
  lowest_transaction numeric
)
language sql
stable
as $$
  select
    c.id as category_id,
    c.name as category_name,
    c.icon,
    c.color,
    c.parent_id,
    coalesce(sum(e.amount), 0) as total,
    count(e.id) as txn_count,
    case when count(e.id) = 0 then 0 else round(sum(e.amount) / count(e.id), 2) end as avg_transaction,
    max(e.amount) as highest_transaction,
    min(e.amount) as lowest_transaction
  from categories c
  join expenses e
    on e.category_id = c.id
    and e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
    and (p_paid_by is null or e.paid_by = p_paid_by)
  group by c.id, c.name, c.icon, c.color, c.parent_id
  order by total desc;
$$;

-- ---------------------------------------------------------
-- Spending by person (spec section 8C)
-- ---------------------------------------------------------
create or replace function public.get_person_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  paid_by uuid,
  total numeric,
  txn_count bigint,
  avg_transaction numeric
)
language sql
stable
as $$
  select
    e.paid_by,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count,
    case when count(*) = 0 then 0 else round(sum(e.amount) / count(*), 2) end as avg_transaction
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by e.paid_by
  order by total desc;
$$;

-- ---------------------------------------------------------
-- Merchant analytics (spec section 8E, 25)
-- ---------------------------------------------------------
create or replace function public.get_merchant_breakdown(
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
  last_expense_date date
)
language sql
stable
as $$
  select
    m.id as merchant_id,
    m.name as merchant_name,
    coalesce(sum(e.amount), 0) as total,
    count(e.id) as txn_count,
    case when count(e.id) = 0 then 0 else round(sum(e.amount) / count(e.id), 2) end as avg_transaction,
    max(e.amount) as highest_transaction,
    max(e.expense_date) as last_expense_date
  from merchants m
  join expenses e
    on e.merchant_id = m.id
    and e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by m.id, m.name
  order by total desc
  limit p_limit;
$$;

-- ---------------------------------------------------------
-- Item-level analytics — everyday consumption items like Milk (spec section 26, 27)
-- ---------------------------------------------------------
create or replace function public.get_item_analytics(
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
  avg_gap_days numeric
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
    end as avg_gap_days
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by lower(e.item_name)
  order by txn_count desc, total desc
  limit p_limit;
$$;

-- ---------------------------------------------------------
-- Daily spending series — powers the trend chart and the calendar heatmap
-- (spec section 8A, 8F, 23, 33)
-- ---------------------------------------------------------
create or replace function public.get_daily_spending(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null
)
returns table (
  expense_date date,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  select
    e.expense_date,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
    and (p_paid_by is null or e.paid_by = p_paid_by)
  group by e.expense_date
  order by e.expense_date;
$$;

-- ---------------------------------------------------------
-- Top expenses for a period (spec section 31 report content)
-- ---------------------------------------------------------
create or replace function public.get_top_expenses(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_limit int default 10
)
returns table (
  id uuid,
  item_name text,
  amount numeric,
  expense_date date,
  category_id uuid,
  merchant_id uuid,
  paid_by uuid
)
language sql
stable
as $$
  select e.id, e.item_name, e.amount, e.expense_date, e.category_id, e.merchant_id, e.paid_by
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  order by e.amount desc
  limit p_limit;
$$;
