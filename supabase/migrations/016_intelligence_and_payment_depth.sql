-- GharKharch: Spending Intelligence + payment analytics depth (batch phase).
-- Same conventions as 006/015: every function is SQL, STABLE, and runs with
-- the CALLER's privileges (Postgres default SECURITY INVOKER), so RLS on
-- `expenses` still applies even though p_household_id is also checked
-- defensively. Every function returns already-aggregated rows — never raw
-- expense sets. Purely additive: no existing table or function is altered
-- destructively, only new functions are added (or DROP+CREATE for a
-- brand-new function name, never an existing one).

-- ---------------------------------------------------------
-- 1. Category monthly trend — mirrors get_merchant_monthly_trend (015)
--    exactly, for the small per-category sparkline on the Category
--    Analytics tab.
-- ---------------------------------------------------------
create or replace function public.get_category_monthly_trend(
  p_household_id uuid,
  p_category_id uuid,
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
      and e.category_id = p_category_id
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
-- 2. Merchant's share of its own category (distinct from get_merchant_
--    breakdown's share_pct, which is share of the household GRAND total).
--    One row per category this merchant has spend in during the period,
--    sorted by the merchant's total in that category (the UI takes the top
--    row as "the" category for that merchant).
-- ---------------------------------------------------------
create or replace function public.get_merchant_category_share(
  p_household_id uuid,
  p_merchant_id uuid,
  p_start date,
  p_end date
)
returns table (
  category_id uuid,
  category_name text,
  merchant_total_in_category numeric,
  category_total numeric,
  category_share_pct numeric
)
language sql
stable
as $$
  with category_totals as (
    select e.category_id, sum(e.amount) as total
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by e.category_id
  ),
  merchant_by_category as (
    select e.category_id, sum(e.amount) as total
    from expenses e
    where e.household_id = p_household_id
      and e.merchant_id = p_merchant_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by e.category_id
  )
  select
    c.id as category_id,
    c.name as category_name,
    mbc.total as merchant_total_in_category,
    ct.total as category_total,
    case when ct.total = 0 then 0 else round(mbc.total / ct.total * 100, 2) end as category_share_pct
  from merchant_by_category mbc
  join category_totals ct on ct.category_id = mbc.category_id
  join categories c on c.id = mbc.category_id
  order by mbc.total desc;
$$;

-- ---------------------------------------------------------
-- 3. Spending by weekday — powers the Spending Intelligence "highest-
--    spending weekday" figure. extract(dow ...) returns 0 (Sunday) .. 6
--    (Saturday); weekday_num is returned as-is and labeled client-side.
-- ---------------------------------------------------------
create or replace function public.get_spending_by_weekday(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  weekday_num int,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  select
    extract(dow from e.expense_date)::int as weekday_num,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by extract(dow from e.expense_date)
  order by total desc;
$$;

-- ---------------------------------------------------------
-- 4. Expense-type breakdown (personal / household / shared) — the
--    Spending Intelligence "person split" section's household-vs-personal
--    figure. `expense_type` is a fixed enum on `expenses` (migration 001),
--    not user-defined, so no join is needed.
-- ---------------------------------------------------------
create or replace function public.get_expense_type_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  expense_type text,
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
    e.expense_type::text as expense_type,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count,
    case when gt.total = 0 then 0 else round(coalesce(sum(e.amount), 0) / gt.total * 100, 2) end as share_pct
  from scoped e
  cross join grand_total gt
  group by e.expense_type, gt.total
  order by total desc;
$$;

-- ---------------------------------------------------------
-- 5. Recurring vs one-off spend for a period — Spending Intelligence
--    section. `recurring_rule_id` (migration 001) is set only on expenses
--    logged from a recurring rule (never automatically — see
--    `logRecurringOccurrence` in recurring.ts).
-- ---------------------------------------------------------
create or replace function public.get_recurring_vs_oneoff(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  recurring_total numeric,
  recurring_count bigint,
  oneoff_total numeric,
  oneoff_count bigint
)
language sql
stable
as $$
  select
    coalesce(sum(e.amount) filter (where e.recurring_rule_id is not null), 0) as recurring_total,
    count(*) filter (where e.recurring_rule_id is not null) as recurring_count,
    coalesce(sum(e.amount) filter (where e.recurring_rule_id is null), 0) as oneoff_total,
    count(*) filter (where e.recurring_rule_id is null) as oneoff_count
  from expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end;
$$;

-- ---------------------------------------------------------
-- 6. Payment analytics depth: breakdown by specific card / UPI profile
--    (distinct from get_payment_method_breakdown's free-text
--    `payment_method` grouping). Joins expenses.card_id / upi_profile_id
--    (migration 008) to their catalogue tables for a human label.
-- ---------------------------------------------------------
create or replace function public.get_card_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  card_id uuid,
  card_label text,
  last4 text,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  select
    uc.id as card_id,
    uc.custom_name as card_label,
    uc.last4,
    coalesce(sum(e.amount), 0) as total,
    count(e.id) as txn_count
  from user_cards uc
  join expenses e
    on e.card_id = uc.id
    and e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by uc.id, uc.custom_name, uc.last4
  order by total desc;
$$;

create or replace function public.get_upi_breakdown(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  upi_profile_id uuid,
  label text,
  upi_app text,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  select
    up.id as upi_profile_id,
    up.label,
    up.upi_app,
    coalesce(sum(e.amount), 0) as total,
    count(e.id) as txn_count
  from upi_profiles up
  join expenses e
    on e.upi_profile_id = up.id
    and e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_start and p_end
  group by up.id, up.label, up.upi_app
  order by total desc;
$$;
