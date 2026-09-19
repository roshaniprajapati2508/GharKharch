-- GharKharch: Move Advertising & Marketing / Meta Ads under Homemade Business (migration 027)
-- Classifies ad expenditures as operating expenses for the Homemade Business
-- so they appear inside the Business Mini P&L and are excluded from Household Living expenses.

-- =========================================================
-- 1. Create subcategory: Advertising & Marketing under Homemade Business
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, 'Advertising & Marketing', 'megaphone', 'indigo', 7
from categories p
where p.name = 'Homemade Business' and p.household_id is null and p.parent_id is null
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active do nothing;

-- =========================================================
-- 2. Link system merchant 'Meta Ads' to Homemade Business > Advertising & Marketing
-- =========================================================
update merchants
set subcategory_id = (
      select c.id
      from categories c
      join categories p on p.id = c.parent_id
      where p.name = 'Homemade Business'
        and c.name = 'Advertising & Marketing'
        and c.household_id is null
      limit 1
    ),
    category_id = (
      select id
      from categories
      where name = 'Homemade Business'
        and household_id is null
        and parent_id is null
      limit 1
    ),
    aliases = array['facebook ads', 'instagram ads', 'fb ads', 'meta ads', 'google ads', 'ad spend']
where household_id is null
  and normalized_name = 'metaads';

-- =========================================================
-- 3. Re-assign any existing expenses from Personal > Advertising & Marketing to Homemade Business > Advertising & Marketing
-- =========================================================
update expenses
set category_id = (
  select c.id
  from categories c
  join categories p on p.id = c.parent_id
  where p.name = 'Homemade Business'
    and c.name = 'Advertising & Marketing'
    and c.household_id is null
  limit 1
)
where category_id in (
  select c.id
  from categories c
  join categories p on p.id = c.parent_id
  where p.name = 'Personal'
    and c.name = 'Advertising & Marketing'
);

-- =========================================================
-- 4. Deactivate old global 'Personal > Advertising & Marketing' subcategory
-- =========================================================
update categories
set is_active = false
where name = 'Advertising & Marketing'
  and parent_id in (
    select id from categories where name = 'Personal' and household_id is null and parent_id is null
  )
  and household_id is null;
