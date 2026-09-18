-- GharKharch: Fast Expense Scratchpad storage + Rolling Spending Pace
-- benchmark function (spec: Master Implementation Specification, Features
-- 1 & 2).

-- =========================================================
-- Feature 1: Fast Expense Scratchpad
-- =========================================================
-- One draft per household (primary key on household_id, not a separate
-- id) - the scratchpad is a single freeform notepad per household, not a
-- list of saved drafts, so there's exactly one row to upsert into as the
-- user types, autosaving the raw text between sessions/devices until they
-- hit "Save All to GharKharch" and it's cleared.
create table if not exists scratchpad_drafts (
  household_id uuid primary key references households(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table scratchpad_drafts enable row level security;

create policy "scratchpad_drafts_select" on scratchpad_drafts
  for select using (public.is_household_member(household_id));

create policy "scratchpad_drafts_insert" on scratchpad_drafts
  for insert with check (public.is_household_member(household_id));

create policy "scratchpad_drafts_update" on scratchpad_drafts
  for update using (public.is_household_member(household_id));

create policy "scratchpad_drafts_delete" on scratchpad_drafts
  for delete using (public.is_household_member(household_id));

comment on table scratchpad_drafts is
  'Autosaved raw text for the Fast Expense Scratchpad (migration 026) - one row per household, upserted on every debounced keystroke, cleared once its lines are converted to real expenses via bulkCreateExpenses().';

-- =========================================================
-- Feature 2: Rolling Spending Pace & Historical Benchmark
-- =========================================================
-- "Are we spending faster or slower than usual at this point in the
-- month?" - compares this month's spend-so-far (through today's day-of-
-- month) against the household's own historical average spend through the
-- same day-of-month, over the past 3/6/12 months. Business-vs-household
-- scope is deliberately NOT split here (unlike get_expense_summary in
-- migration 021) - this is a whole-household pace signal, matching how
-- the spec's UI copy talks about "your typical monthly spend" as a single
-- number, not two.
create or replace function public.get_spending_pace_benchmark(
  p_household_id uuid,
  p_current_date date default current_date
)
returns table (
  current_day int,
  days_in_month int,
  month_progress_pct numeric,
  current_mtd_spend numeric,
  projected_month_end numeric,
  avg_3m_mtd_spend numeric,
  avg_6m_mtd_spend numeric,
  avg_12m_mtd_spend numeric,
  pace_vs_6m_pct numeric, -- e.g. -12.5 (frugal) or +18.2 (elevated)
  pace_status text        -- 'frugal' | 'on_track' | 'elevated'
)
language plpgsql
stable
as $$
declare
  v_start_of_month date := date_trunc('month', p_current_date)::date;
  v_end_of_month date := (date_trunc('month', p_current_date) + interval '1 month - 1 day')::date;
  v_current_day int := extract(day from p_current_date)::int;
  v_days_in_month int := extract(day from v_end_of_month)::int;
  v_current_mtd numeric;
  v_avg_3m numeric;
  v_avg_6m numeric;
  v_avg_12m numeric;
  v_pace_pct numeric;
  v_status text;
begin
  -- 1. Current Month-To-Date Spend (expense rows only - entry_type,
  --    migration 022 - so logged income never dilutes the pace signal).
  select coalesce(sum(amount), 0) into v_current_mtd
  from expenses
  where household_id = p_household_id
    and deleted_at is null
    and entry_type = 'expense'
    and expense_date between v_start_of_month and p_current_date;

  -- 2. Average historical spend up to day N, over the past 6 months.
  select coalesce(avg(monthly_subtotal), 0) into v_avg_6m
  from (
    select date_trunc('month', expense_date), sum(amount) as monthly_subtotal
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and entry_type = 'expense'
      and expense_date >= (v_start_of_month - interval '6 months')::date
      and expense_date < v_start_of_month
      and extract(day from expense_date) <= v_current_day
    group by date_trunc('month', expense_date)
  ) past_6m;

  -- 3. Same, over the past 3 and 12 months.
  select coalesce(avg(monthly_subtotal), 0) into v_avg_3m
  from (
    select date_trunc('month', expense_date), sum(amount) as monthly_subtotal
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and entry_type = 'expense'
      and expense_date >= (v_start_of_month - interval '3 months')::date
      and expense_date < v_start_of_month
      and extract(day from expense_date) <= v_current_day
    group by date_trunc('month', expense_date)
  ) past_3m;

  select coalesce(avg(monthly_subtotal), 0) into v_avg_12m
  from (
    select date_trunc('month', expense_date), sum(amount) as monthly_subtotal
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and entry_type = 'expense'
      and expense_date >= (v_start_of_month - interval '12 months')::date
      and expense_date < v_start_of_month
      and extract(day from expense_date) <= v_current_day
    group by date_trunc('month', expense_date)
  ) past_12m;

  -- 4. Pace % vs the 6-month baseline (the dashboard's default comparison).
  if v_avg_6m > 0 then
    v_pace_pct := round(((v_current_mtd - v_avg_6m) / v_avg_6m) * 100, 1);
  else
    v_pace_pct := 0;
  end if;

  if v_pace_pct <= -5.0 then
    v_status := 'frugal';
  elsif v_pace_pct >= 10.0 then
    v_status := 'elevated';
  else
    v_status := 'on_track';
  end if;

  return query select
    v_current_day,
    v_days_in_month,
    round((v_current_day::numeric / v_days_in_month::numeric) * 100, 1),
    v_current_mtd,
    case when v_current_day > 0 then round((v_current_mtd / v_current_day) * v_days_in_month, 2) else 0 end,
    round(v_avg_3m, 2),
    round(v_avg_6m, 2),
    round(v_avg_12m, 2),
    v_pace_pct,
    v_status;
end;
$$;

comment on function public.get_spending_pace_benchmark is
  'Compares this month''s spend-to-date against the household''s own 3/6/12-month historical average through the same day-of-month (migration 026) - backs the dashboard''s Rolling Spending Pace gauge.';
