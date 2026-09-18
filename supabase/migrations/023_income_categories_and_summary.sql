-- GharKharch: general household income (Module A) - Salary, Freelancing &
-- Consulting, and Business Sales & Payouts as first-class income
-- categories, plus marketplace/client merchants for logging them, plus a
-- get_income_summary() function so the dashboard can show total inflow
-- (and its breakdown) aggregated in Postgres like everything else.
--
-- `categories.type` ('expense' | 'income') has existed since migration 001
-- but nothing ever seeded an 'income' category before now - every category
-- seeded so far (004, 020) was 'expense'. This is the first migration to
-- actually use that column for its intended purpose.
--
-- Seeded as global (household_id null) categories/merchants, same
-- convention as every other seed migration in this project (004, 020) -
-- every household sees them, and can hide or customize them the same way
-- they can any other global default (migration 014).

insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
values
  (null, null, 'Salary', 'banknote', 'emerald', 'income', 100),
  (null, null, 'Freelancing & Consulting', 'laptop', 'blue', 'income', 101),
  (null, null, 'Business Sales & Payouts', 'shopping-bag', 'indigo', 'income', 102)
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- normalized_name matches normalizeMerchantName() in src/lib/merchant-utils.ts
-- (lowercase, strip everything but a-z0-9) - same convention migration 020
-- already used for its seeded merchants.
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases)
values
  (null, 'Amazon Seller Payout', 'amazonsellerpayout', 'marketplace', 'online', true, array['amazon seller', 'amazon payout']),
  (null, 'Flipkart Seller Payout', 'flipkartsellerpayout', 'marketplace', 'online', true, array['flipkart seller', 'flipkart payout']),
  (null, 'Meesho Seller Payout', 'meeshosellerpayout', 'marketplace', 'online', true, array['meesho seller', 'meesho payout']),
  (null, 'Website Orders', 'websiteorders', 'marketplace', 'online', true, array['website sales', 'shopify order', 'direct order']),
  (null, 'Freelance Client', 'freelanceclient', 'other', 'mixed', true, array['client payment', 'consulting'])
on conflict (normalized_name) where household_id is null
do nothing;

-- Total household inflow (spec: Module A cashflow cards) - every
-- entry_type = 'income' row, grouped by its top-level category so the
-- dashboard can show "Salary: X · Freelance: Y · Business: Z" rather than
-- only a single combined figure. Deliberately separate from
-- get_business_pnl (migration 022), which answers a narrower question -
-- the Homemade Business's own P&L - not "how much came in overall".
create function public.get_income_summary(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  category_id uuid,
  category_name text,
  total numeric,
  txn_count bigint
)
language sql
stable
as $$
  select
    coalesce(top.id, c.id) as category_id,
    coalesce(top.name, c.name) as category_name,
    coalesce(sum(e.amount), 0) as total,
    count(*) as txn_count
  from expenses e
  join categories c on c.id = e.category_id
  left join categories top on top.id = c.parent_id
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.entry_type = 'income'
    and e.expense_date between p_start and p_end
  group by coalesce(top.id, c.id), coalesce(top.name, c.name)
  order by total desc;
$$;

comment on function public.get_income_summary is
  'Total household income for a date range, grouped by top-level category (migration 023) - Salary / Freelancing / Business Sales, etc.';
