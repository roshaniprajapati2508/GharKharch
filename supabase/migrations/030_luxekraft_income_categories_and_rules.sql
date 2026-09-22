-- GharKharch: LuxeKraft Incoming Payment Categories & Smart Rules (migration 030)
-- Seeds the 4 Top-level Income Categories and 13 Subcategories for Homemade Business LuxeKraft,
-- creates 14 IFTTT Smart Rules for instant auto-detection of incoming customer payments,
-- and updates get_business_pnl() to include LuxeKraft income categories in net profit calculation.

-- =========================================================
-- 1. Top-level Categories (type = 'income', household_id = null)
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
values
  (null, null, 'Mobile Covers & Sets', 'smartphone', 'blue', 'income', 110),
  (null, null, 'Only Accessories', 'sparkles', 'purple', 'income', 111),
  (null, null, 'Handmade Jewellery, Watches & Collections', 'gem', 'pink', 'income', 112),
  (null, null, 'Handmade Crafts & Occasions', 'palette', 'amber', 'income', 113)
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 2. Subcategories under Mobile Covers & Sets
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
select null, p.id, c.name, c.icon, 'blue', 'income', c.sort_order
from categories p, (values
  ('Mobile Cover', 'smartphone', 1)
) as c(name, icon, sort_order)
where p.name = 'Mobile Covers & Sets' and p.household_id is null and p.parent_id is null and p.type = 'income'
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 3. Subcategories under Only Accessories
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
select null, p.id, c.name, c.icon, 'purple', 'income', c.sort_order
from categories p, (values
  ('Only Sling Chain with Ghugri', 'sparkles', 1),
  ('Only Sling Chain with Ghugri, Coins & Metal Kodi', 'sparkles', 2),
  ('Only Waist Judo', 'sparkles', 3),
  ('Macrame Mobile Sling', 'package', 4)
) as c(name, icon, sort_order)
where p.name = 'Only Accessories' and p.household_id is null and p.parent_id is null and p.type = 'income'
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 4. Subcategories under Handmade Jewellery, Watches & Collections
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
select null, p.id, c.name, c.icon, 'pink', 'income', c.sort_order
from categories p, (values
  ('Haldi Jewellery', 'sun', 1),
  ('Mehndi Jewellery', 'sparkles', 2),
  ('Navratri Collection', 'flower-2', 3),
  ('Other Handmade Jewellery', 'gem', 4),
  ('Kashmiri Watch', 'watch', 5)
) as c(name, icon, sort_order)
where p.name = 'Handmade Jewellery, Watches & Collections' and p.household_id is null and p.parent_id is null and p.type = 'income'
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 5. Subcategories under Handmade Crafts & Occasions
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
select null, p.id, c.name, c.icon, 'amber', 'income', c.sort_order
from categories p, (values
  ('Lippon Art', 'palette', 1),
  ('Return Gift', 'gift', 2),
  ('Baby Shower', 'baby', 3)
) as c(name, icon, sort_order)
where p.name = 'Handmade Crafts & Occasions' and p.household_id is null and p.parent_id is null and p.type = 'income'
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 6. IFTTT Smart Rules for LuxeKraft Incoming Payments
-- =========================================================
insert into automation_rules (household_id, name, priority, conditions, actions)
values
  -- 1. Mobile Cover
  (null, 'LuxeKraft Mobile Cover Sale', 100,
    '{"keywords": ["mobile cover", "phone cover", "cover order", "mobile case", "phone case", "mobile cover sale", "mobile cover set"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Mobile Cover", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 2. Only Sling Chain with Ghugri
  (null, 'LuxeKraft Sling Chain with Ghugri', 100,
    '{"keywords": ["sling chain with ghugri", "ghugri chain", "ghugri sling", "sling chain order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Only Accessories", "subcategory_name": "Only Sling Chain with Ghugri", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 3. Only Sling Chain with Ghugri, Coins & Metal Kodi
  (null, 'LuxeKraft Sling Chain Coins & Metal Kodi', 100,
    '{"keywords": ["ghugri, coins & metal kodi", "ghugri coins metal kodi", "metal kodi", "coins metal kodi", "kodi chain", "coins kodi chain"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Only Accessories", "subcategory_name": "Only Sling Chain with Ghugri, Coins & Metal Kodi", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 4. Only Waist Judo
  (null, 'LuxeKraft Waist Judo', 100,
    '{"keywords": ["waist judo", "kamar judo", "waist judo order", "judo accessory"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Only Accessories", "subcategory_name": "Only Waist Judo", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 5. Macrame Mobile Sling
  (null, 'LuxeKraft Macrame Mobile Sling', 100,
    '{"keywords": ["macrame mobile sling", "macrame sling", "macrame phone strap", "macrame strap"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Only Accessories", "subcategory_name": "Macrame Mobile Sling", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 6. Haldi Jewellery
  (null, 'LuxeKraft Haldi Jewellery', 100,
    '{"keywords": ["haldi jewellery", "haldi set", "haldi flower jewellery", "haldi accessories", "haldi jewellery order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Jewellery, Watches & Collections", "subcategory_name": "Haldi Jewellery", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 7. Mehndi Jewellery
  (null, 'LuxeKraft Mehndi Jewellery', 100,
    '{"keywords": ["mehndi jewellery", "mehndi jewellery set", "mehendi jewellery order", "mehndi jewellery order", "mehndi set order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Jewellery, Watches & Collections", "subcategory_name": "Mehndi Jewellery", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 8. Navratri Collection
  (null, 'LuxeKraft Navratri Collection', 100,
    '{"keywords": ["navratri collection", "navratri jewellery", "chaniya choli jewellery", "garba jewellery", "navratri set", "navratri order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Jewellery, Watches & Collections", "subcategory_name": "Navratri Collection", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 9. Other Handmade Jewellery
  (null, 'LuxeKraft Other Handmade Jewellery', 100,
    '{"keywords": ["other handmade jewellery", "handmade jewellery", "handmade earrings", "handmade necklace", "handmade choker", "handmade bracelet", "custom jewellery order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Jewellery, Watches & Collections", "subcategory_name": "Other Handmade Jewellery", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 10. Kashmiri Watch
  (null, 'LuxeKraft Kashmiri Watch', 100,
    '{"keywords": ["kashmiri watch", "kashmiri belt watch", "handmade watch", "kashmiri watch order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Jewellery, Watches & Collections", "subcategory_name": "Kashmiri Watch", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 11. Lippon Art
  (null, 'LuxeKraft Lippon Art', 100,
    '{"keywords": ["lippon art", "lippan art", "lippon frame", "mud mirror art", "lippan work", "lippon artwork", "lippon order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Crafts & Occasions", "subcategory_name": "Lippon Art", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 12. Return Gift
  (null, 'LuxeKraft Return Gift', 100,
    '{"keywords": ["return gift", "return gifts", "wedding return gift", "favor gift", "bulk return gifts", "return gift order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Crafts & Occasions", "subcategory_name": "Return Gift", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 13. Baby Shower
  (null, 'LuxeKraft Baby Shower', 100,
    '{"keywords": ["baby shower", "baby shower gifts", "godh bharai", "baby shower hamper", "baby shower props", "baby shower order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Handmade Crafts & Occasions", "subcategory_name": "Baby Shower", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 14. General LuxeKraft Order
  (null, 'LuxeKraft Store Order', 90,
    '{"keywords": ["luxekraft", "luxe kraft", "luxekraft order", "luxekraft sale", "luxekraft payment", "craft order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Mobile Cover", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb)
on conflict do nothing;

-- =========================================================
-- 7. Update get_business_pnl() to include LuxeKraft Income Categories
-- =========================================================
create or replace function public.get_business_pnl(
  p_household_id uuid,
  p_start date,
  p_end date
)
returns table (
  income_total numeric,
  expense_total numeric,
  net_profit numeric,
  income_count bigint,
  expense_count bigint
)
language sql
stable
as $$
  with business_top as (
    select id from categories
    where name in (
      'Homemade Business',
      'Business Sales & Payouts',
      'Mobile Covers & Sets',
      'Only Accessories',
      'Handmade Jewellery, Watches & Collections',
      'Handmade Crafts & Occasions'
    )
      and (household_id = p_household_id or household_id is null)
  ),
  scoped as (
    select e.*
    from expenses e
    join categories c on c.id = e.category_id
    where e.household_id = p_household_id
      and e.deleted_at is null
      and e.expense_date between p_start and p_end
      and (c.id in (select id from business_top) or c.parent_id in (select id from business_top))
  )
  select
    coalesce(sum(amount) filter (where entry_type = 'income'), 0) as income_total,
    coalesce(sum(amount) filter (where entry_type = 'expense'), 0) as expense_total,
    coalesce(sum(amount) filter (where entry_type = 'income'), 0)
      - coalesce(sum(amount) filter (where entry_type = 'expense'), 0) as net_profit,
    count(*) filter (where entry_type = 'income') as income_count,
    count(*) filter (where entry_type = 'expense') as expense_count
  from scoped;
$$;

comment on function public.get_business_pnl is
  'Mini P&L for Homemade Business (migration 030): includes LuxeKraft product categories in business income and net profit calculation.';
