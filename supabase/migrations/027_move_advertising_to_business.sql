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
update merchants m
set subcategory_id = c.id,
    category_id = p.id,
    aliases = array['facebook ads', 'instagram ads', 'fb ads', 'meta ads', 'google ads', 'ad spend']
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and m.normalized_name = 'metaads'
  and p.name = 'Homemade Business'
  and c.name = 'Advertising & Marketing';

-- =========================================================
-- 3. Re-assign any existing expenses from Personal > Advertising & Marketing to Homemade Business > Advertising & Marketing
-- =========================================================
update expenses e
set category_id = c_new.id
from categories c_old
join categories p_old on p_old.id = c_old.parent_id
cross join lateral (
  select c.id
  from categories c
  join categories p on p.id = c.parent_id
  where p.name = 'Homemade Business'
    and c.name = 'Advertising & Marketing'
    and (c.household_id = e.household_id or c.household_id is null)
  order by c.household_id nulls last
  limit 1
) c_new
where e.category_id = c_old.id
  and c_old.name = 'Advertising & Marketing'
  and p_old.name = 'Personal';

-- =========================================================
-- 4. Deactivate old global 'Personal > Advertising & Marketing' subcategory
-- =========================================================
update categories c
set is_active = false
from categories p
where c.parent_id = p.id
  and p.name = 'Personal'
  and c.name = 'Advertising & Marketing'
  and c.household_id is null;
