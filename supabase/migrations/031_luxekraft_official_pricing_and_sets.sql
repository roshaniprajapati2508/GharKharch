-- GharKharch: LuxeKraft Official Navratri Offer Pricing & Full Sets Expansion (migration 031)
-- Adds the exact product combinations, sets, and smart rules from LuxeKraft's official price card.

-- =========================================================
-- 1. Expanded Subcategories under Mobile Covers & Sets
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, type, sort_order)
select null, p.id, c.name, c.icon, 'blue', 'income', c.sort_order
from categories p, (values
  ('Cover + Jul', 'smartphone', 2),
  ('Cover + Waist Judo', 'smartphone', 3),
  ('Cover + Short Chain', 'smartphone', 4),
  ('Cover + Feather', 'smartphone', 5),
  ('Cover + Waist Judo + Jul', 'smartphone', 6),
  ('Cover + Sling Chain with Ghugri', 'smartphone', 7),
  ('Cover + Sling Chain with Ghugri, Coins & Metal Kodi', 'smartphone', 8),
  ('Cover + Short Chain + Waist Judo', 'smartphone', 9),
  ('Cover + Feather With Jul', 'smartphone', 10),
  ('Full Set 1: Cover + Waist Judo + Sling Chain with Ghugri', 'smartphone', 11),
  ('Full Set 2: Cover + Waist Judo + Sling Chain with Ghugri, Coins & Metal Kodi', 'smartphone', 12)
) as c(name, icon, sort_order)
where p.name = 'Mobile Covers & Sets' and p.household_id is null and p.parent_id is null and p.type = 'income'
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active
do nothing;

-- =========================================================
-- 2. Smart Rules for LuxeKraft Sets & Exact Offer Combinations
-- =========================================================
insert into automation_rules (household_id, name, priority, conditions, actions)
values
  -- Cover + Waist Judo (Most Popular - Rs 1,299)
  (null, 'LuxeKraft Cover + Waist Judo (Rs 1,299)', 110,
    '{"keywords": ["cover + waist judo", "cover with waist judo", "cover and waist judo", "cover judo"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Waist Judo", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Sling Chain with Ghugri (Rs 1,499)
  (null, 'LuxeKraft Cover + Sling Ghugri (Rs 1,499)', 110,
    '{"keywords": ["cover + sling chain with ghugri", "cover with ghugri sling", "cover and sling ghugri"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Sling Chain with Ghugri", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Sling Chain with Ghugri, Coins & Metal Kodi (Rs 1,599)
  (null, 'LuxeKraft Cover + Coins & Kodi Sling (Rs 1,599)', 110,
    '{"keywords": ["cover + sling chain with ghugri, coins & metal kodi", "cover with coins and kodi", "cover kodi sling"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Sling Chain with Ghugri, Coins & Metal Kodi", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Full Set 1 (Rs 1,899)
  (null, 'LuxeKraft Full Set 1 (Rs 1,899)', 115,
    '{"keywords": ["full set 1", "full set 1: cover + waist judo + sling chain with ghugri", "full set 1 cover"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Full Set 1: Cover + Waist Judo + Sling Chain with Ghugri", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Full Set 2 (Bestseller - Rs 1,999)
  (null, 'LuxeKraft Full Set 2 Bestseller (Rs 1,999)', 115,
    '{"keywords": ["full set 2", "full set 2: cover + waist judo + sling chain with ghugri, coins & metal kodi", "full set 2 cover", "bestseller set"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Full Set 2: Cover + Waist Judo + Sling Chain with Ghugri, Coins & Metal Kodi", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Jul (Rs 1,199)
  (null, 'LuxeKraft Cover + Jul (Rs 1,199)', 105,
    '{"keywords": ["cover + jul", "cover with jul"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Jul", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Short Chain (Rs 1,399)
  (null, 'LuxeKraft Cover + Short Chain (Rs 1,399)', 105,
    '{"keywords": ["cover + short chain", "cover with short chain"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Short Chain", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Feather (Rs 1,399)
  (null, 'LuxeKraft Cover + Feather (Rs 1,399)', 105,
    '{"keywords": ["cover + feather", "cover with feather"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Feather", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Waist Judo + Jul (Rs 1,399)
  (null, 'LuxeKraft Cover + Judo + Jul (Rs 1,399)', 105,
    '{"keywords": ["cover + waist judo + jul", "cover with judo and jul"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Waist Judo + Jul", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Short Chain + Waist Judo (Rs 1,599)
  (null, 'LuxeKraft Cover + Short Chain + Judo (Rs 1,599)', 105,
    '{"keywords": ["cover + short chain + waist judo", "short chain waist judo 2 in 1"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Short Chain + Waist Judo", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Cover + Feather With Jul (Rs 1,599)
  (null, 'LuxeKraft Cover + Feather With Jul (Rs 1,599)', 105,
    '{"keywords": ["cover + feather with jul", "feather with jul cover"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Cover + Feather With Jul", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- Custom Name on Cover Add-on (Rs 100)
  (null, 'LuxeKraft Custom Name Add-on (Rs 100)', 100,
    '{"keywords": ["custom name on cover", "name on cover", "custom name addon"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Mobile Covers & Sets", "subcategory_name": "Mobile Cover", "merchant_name": "LuxeKraft", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb)
on conflict do nothing;
