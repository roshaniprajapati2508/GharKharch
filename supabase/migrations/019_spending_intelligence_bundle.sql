-- GharKharch: Spending Intelligence master consolidation function.
-- Consolidates all 13-15 sub-queries into a single STABLE SQL function returning
-- a unified JSONB object in one database round-trip.

create or replace function public.get_spending_intelligence_bundle(
  p_household_id uuid,
  p_start date,
  p_end date,
  p_prev_start date,
  p_prev_end date,
  p_month_start date,
  p_month_end date,
  p_prev_month_start date,
  p_prev_month_end date
)
returns jsonb
language sql
stable
as $$
  with
  -- 1. Summary of current period
  summary_cte as (
    select
      coalesce(sum(amount), 0) as total,
      count(*) as txn_count,
      case when count(*) = 0 then 0 else round(coalesce(sum(amount), 0) / count(*), 2) end as avg_transaction
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and expense_date between p_start and p_end
  ),

  -- 2. Spending by weekday
  weekday_cte as (
    select
      extract(dow from expense_date)::int as weekday_num,
      sum(amount) as total,
      count(*) as txn_count
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and expense_date between p_start and p_end
    group by extract(dow from expense_date)
    order by total desc
  ),

  -- 3. Daily spending
  daily_cte as (
    select
      expense_date::text as expense_date,
      sum(amount) as total,
      count(*) as txn_count
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and expense_date between p_start and p_end
    group by expense_date
    order by expense_date asc
  ),

  -- 4. Expense type breakdown (personal / household / shared)
  expense_type_cte as (
    select
      e.expense_type::text as expense_type,
      sum(e.amount) as total,
      count(*) as txn_count,
      case when s.total = 0 then 0 else round(sum(e.amount) / s.total * 100, 2) end as share_pct
    from expenses e
    cross join summary_cte s
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by e.expense_type, s.total
    order by total desc
  ),

  -- 5. Person breakdown with display name joined
  person_cte as (
    select
      e.paid_by,
      coalesce(p.display_name, 'Someone') as name,
      sum(e.amount) as total,
      count(e.id) as txn_count,
      round(sum(e.amount) / count(e.id), 2) as avg_transaction
    from expenses e
    left join profiles p on p.id = e.paid_by
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by e.paid_by, p.display_name
    order by total desc
  ),

  -- 6. Recurring vs one-off
  recurring_cte as (
    select
      coalesce(sum(amount) filter (where recurring_rule_id is not null), 0) as recurring_total,
      count(*) filter (where recurring_rule_id is not null) as recurring_count,
      coalesce(sum(amount) filter (where recurring_rule_id is null), 0) as oneoff_total,
      count(*) filter (where recurring_rule_id is null) as oneoff_count
    from expenses
    where household_id = p_household_id
      and deleted_at is null
      and expense_date between p_start and p_end
  ),

  -- 7. Current & previous merchants (top 50)
  merchant_current_cte as (
    select
      m.id as merchant_id,
      m.name as merchant_name,
      sum(e.amount) as total
    from expenses e
    join merchants m on m.id = e.merchant_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by m.id, m.name
    order by total desc
    limit 50
  ),
  merchant_prev_cte as (
    select
      m.id as merchant_id,
      m.name as merchant_name,
      sum(e.amount) as total
    from expenses e
    join merchants m on m.id = e.merchant_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_prev_start and p_prev_end
    group by m.id, m.name
    order by total desc
    limit 50
  ),

  -- 8. Current & previous items (top 50)
  item_current_cte as (
    select
      lower(e.item_name) as item_name,
      sum(e.amount) as total
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
    group by lower(e.item_name)
    order by count(*) desc, total desc
    limit 50
  ),
  item_prev_cte as (
    select
      lower(e.item_name) as item_name,
      sum(e.amount) as total
    from expenses e
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_prev_start and p_prev_end
    group by lower(e.item_name)
    order by count(*) desc, total desc
    limit 50
  ),

  -- 9. Month vs previous month categories
  category_month_cte as (
    select
      c.id as category_id,
      c.name as category_name,
      sum(e.amount) as total
    from categories c
    join expenses e on e.category_id = c.id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_month_start and p_month_end
    group by c.id, c.name
    order by total desc
  ),
  category_prev_month_cte as (
    select
      c.id as category_id,
      c.name as category_name,
      sum(e.amount) as total
    from categories c
    join expenses e on e.category_id = c.id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_prev_month_start and p_prev_month_end
    group by c.id, c.name
    order by total desc
  )

  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'total', total,
        'txn_count', txn_count,
        'avg_transaction', avg_transaction
      ) from summary_cte
    ),
    'weekday_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekday_num', weekday_num,
          'total', total,
          'txn_count', txn_count
        )
      ) from weekday_cte
    ), '[]'::jsonb),
    'daily_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'expense_date', expense_date,
          'total', total,
          'txn_count', txn_count
        )
      ) from daily_cte
    ), '[]'::jsonb),
    'expense_type_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'expense_type', expense_type,
          'total', total,
          'txn_count', txn_count,
          'share_pct', share_pct
        )
      ) from expense_type_cte
    ), '[]'::jsonb),
    'person_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'paid_by', paid_by,
          'name', name,
          'total', total,
          'txn_count', txn_count,
          'avg_transaction', avg_transaction
        )
      ) from person_cte
    ), '[]'::jsonb),
    'recurring_row', (
      select jsonb_build_object(
        'recurring_total', recurring_total,
        'recurring_count', recurring_count,
        'oneoff_total', oneoff_total,
        'oneoff_count', oneoff_count
      ) from recurring_cte
    ),
    'merchant_current_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'merchant_id', merchant_id,
          'merchant_name', merchant_name,
          'total', total
        )
      ) from merchant_current_cte
    ), '[]'::jsonb),
    'merchant_prev_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'merchant_id', merchant_id,
          'merchant_name', merchant_name,
          'total', total
        )
      ) from merchant_prev_cte
    ), '[]'::jsonb),
    'item_current_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_name', item_name,
          'total', total
        )
      ) from item_current_cte
    ), '[]'::jsonb),
    'item_prev_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_name', item_name,
          'total', total
        )
      ) from item_prev_cte
    ), '[]'::jsonb),
    'category_month_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', category_id,
          'category_name', category_name,
          'total', total
        )
      ) from category_month_cte
    ), '[]'::jsonb),
    'category_prev_month_rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', category_id,
          'category_name', category_name,
          'total', total
        )
      ) from category_prev_month_cte
    ), '[]'::jsonb)
  );
$$;
