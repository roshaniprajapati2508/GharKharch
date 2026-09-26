-- GharKharch: Rename LuxeKraft to LuxeKraft.Shop (migration 035)
-- Renames Merchant, Subcategory, Automation Rules, and existing Expenses
-- from "LuxeKraft" to "LuxeKraft.Shop" so that transaction lists and income
-- records display "LuxeKraft.Shop".

-- =========================================================
-- 1. Rename Merchant in merchants table
-- =========================================================

update merchants
set name = 'LuxeKraft.Shop',
    aliases = array_cat(
      coalesce(aliases, array[]::text[]),
      array['luxekraft.shop', 'luxekraft shop', 'luxe kraft shop', 'luxekraft', 'luxe kraft']
    )
where normalized_name in ('luxekraft', 'luxekraftshop')
   or lower(trim(name)) in ('luxekraft', 'luxekraft.shop');

-- If LuxeKraft merchant doesn't exist, insert LuxeKraft.Shop
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases)
values (
  null,
  'LuxeKraft.Shop',
  'luxekraft',
  'shopping',
  'mixed',
  true,
  array['luxekraft.shop', 'luxekraft shop', 'luxe kraft', 'craft store', 'craft raw material', 'luxe kraft shop']
)
on conflict (normalized_name) where household_id is null
do update set name = 'LuxeKraft.Shop';

-- =========================================================
-- 2. Rename Subcategory under "Homemade Business" (if exists)
-- =========================================================

update categories
set name = 'LuxeKraft.Shop'
where lower(trim(name)) = 'luxekraft';

-- =========================================================
-- 3. Update Existing Expenses & Incomes
-- =========================================================

-- Update any expense whose item_name is exactly "LuxeKraft"
update expenses
set item_name = 'LuxeKraft.Shop'
where trim(lower(item_name)) = 'luxekraft';

-- =========================================================
-- 4. Update Automation Rules to target "LuxeKraft.Shop"
-- =========================================================

update automation_rules
set actions = jsonb_set(actions, '{merchant_name}', '"LuxeKraft.Shop"')
where actions->>'merchant_name' = 'LuxeKraft';

update automation_rules
set actions = jsonb_set(actions, '{subcategory_name}', '"LuxeKraft.Shop"')
where actions->>'subcategory_name' = 'LuxeKraft';
