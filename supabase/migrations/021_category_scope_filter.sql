-- GharKharch: Household vs Homemade Business scope filter for Analytics and
-- Reports (Task 4 of the MAX-Level Deep Intelligence roadmap). Adds an
-- optional `p_category_scope` argument ('household' | 'business' | null) to
-- every read-only aggregation function those two screens call, so the
-- existing "All / Household Only / Business Only" toggle can recalculate
-- summary totals and every breakdown in Postgres - never by fetching raw
-- expenses into the browser and summing them there (same rule every prior
-- analytics migration in this project follows).
--
-- A null p_category_scope behaves exactly as before (every existing caller
-- that doesn't pass it keeps working unchanged). 'business' includes only
-- expenses whose category is the "Homemade Business" top-level category
-- itself or one of its subcategories (LuxeKraft, Roshni's Mehndi Art,
-- Printing & Xerox, Courier & Shipping, Raw Materials, Stationery & Office -
-- migration 020); 'household' is everything else. Matched by category NAME,
-- not id, same convention as keyword-map.ts and every seed migration - ids
-- are generated per environment and per household-owned copy.
--
-- Every one of these changes the function's argument list, so each is
-- DROP + CREATE rather than CREATE OR REPLACE (Postgres won't let you widen
-- an argument list in place without risking an ambiguous overload sitting
-- alongside the old signature) - same approach 015/018 already used in this
-- project for exactly this reason.

-- ---------------------------------------------------------
-- Overall summary for a period
-- ---------------------------------------------------------
drop function if exists public.get_expense_summary(uuid, date, date, uuid);

create function public.get_expense_summary(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  ),
  scoped as (
    select e.*
    from expenses e
    join categories c on c.id = e.category_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
      and (p_paid_by is null or e.paid_by = p_paid_by)
      and (
        p_category_scope is null
        or (
          p_category_scope = 'business'
          and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
        or (
          p_category_scope = 'household'
          and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
      )
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
-- Category breakdown
-- ---------------------------------------------------------
drop function if exists public.get_category_breakdown(uuid, date, date, uuid);

create function public.get_category_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  )
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
  where (
    p_category_scope is null
    or (
      p_category_scope = 'business'
      and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
    )
    or (
      p_category_scope = 'household'
      and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
    )
  )
  group by c.id, c.name, c.icon, c.color, c.parent_id
  order by total desc;
$$;

-- ---------------------------------------------------------
-- Spending by person
-- ---------------------------------------------------------
drop function if exists public.get_person_breakdown(uuid, date, date);

create function public.get_person_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  )
  select
    e.paid_by,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count,
    case when count(*) = 0 then 0 else round(sum(e.amount) / count(*), 2) end as avg_transaction
  from expenses e
  join categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
    and (
      p_category_scope is null
      or (
        p_category_scope = 'business'
        and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
      or (
        p_category_scope = 'household'
        and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
    )
  group by e.paid_by
  order by total desc;
$$;

-- ---------------------------------------------------------
-- Merchant analytics (return columns match 015_analytics_enhancements.sql)
-- ---------------------------------------------------------
drop function if exists public.get_merchant_breakdown(uuid, date, date, int);

create function public.get_merchant_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_limit int default 10,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  ),
  scoped as (
    select e.*
    from expenses e
    join categories c on c.id = e.category_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
      and (
        p_category_scope is null
        or (
          p_category_scope = 'business'
          and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
        or (
          p_category_scope = 'household'
          and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
      )
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
-- Item-level analytics (return columns match 015_analytics_enhancements.sql)
-- ---------------------------------------------------------
drop function if exists public.get_item_analytics(uuid, date, date, int);

create function public.get_item_analytics(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_limit int default 20,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  )
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
  join categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
    and (
      p_category_scope is null
      or (
        p_category_scope = 'business'
        and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
      or (
        p_category_scope = 'household'
        and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
    )
  group by lower(e.item_name)
  order by txn_count desc, total desc
  limit p_limit;
$$;

-- ---------------------------------------------------------
-- Daily spending series
-- ---------------------------------------------------------
drop function if exists public.get_daily_spending(uuid, date, date, uuid);

create function public.get_daily_spending(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_paid_by uuid default null,
  p_category_scope text default null
)
returns table (
  expense_date date,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  )
  select
    e.expense_date,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count
  from expenses e
  join categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
    and (p_paid_by is null or e.paid_by = p_paid_by)
    and (
      p_category_scope is null
      or (
        p_category_scope = 'business'
        and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
      or (
        p_category_scope = 'household'
        and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
      )
    )
  group by e.expense_date
  order by e.expense_date;
$$;

-- ---------------------------------------------------------
-- Payment method breakdown (return columns match 015_analytics_enhancements.sql)
-- ---------------------------------------------------------
drop function if exists public.get_payment_method_breakdown(uuid, date, date);

create function public.get_payment_method_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_category_scope text default null
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
  with business_top as (
    select id from categories
    where name = 'Homemade Business'
      and (household_id = p_household_id or household_id is null)
  ),
  scoped as (
    select e.*
    from expenses e
    join categories c on c.id = e.category_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
      and (
        p_category_scope is null
        or (
          p_category_scope = 'business'
          and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
        or (
          p_category_scope = 'household'
          and not (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
        )
      )
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
