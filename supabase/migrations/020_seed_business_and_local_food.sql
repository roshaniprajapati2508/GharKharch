-- GharKharch: Seed Homemade Business categories, Local Food & Kariyana subcategories, and merchants.
-- household_id is null => system/global defaults visible to all households.

-- =========================================================
-- 1. Top-level category: Homemade Business
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
values (null, null, 'Homemade Business', 'briefcase', 'indigo', 25)
on conflict do nothing;

-- =========================================================
-- 2. Subcategories under Homemade Business
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'indigo', c.sort_order
from categories p, (values
  ('LuxeKraft', 'package', 1),
  ('Roshni''s Mehndi Art', 'sparkles', 2),
  ('Printing & Xerox', 'book-open', 3),
  ('Courier & Shipping', 'truck', 4),
  ('Raw Materials', 'package', 5),
  ('Stationery & Office', 'briefcase', 6)
) as c(name, icon, sort_order)
where p.name = 'Homemade Business' and p.household_id is null and p.parent_id is null
on conflict do nothing;

-- =========================================================
-- 3. Additional Local Food & Kariyana subcategories under Food & Grocery
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'green', c.sort_order
from categories p, (values
  ('Nasto & Farsan', 'cookie', 14)
) as c(name, icon, sort_order)
where p.name = 'Food & Grocery' and p.household_id is null and p.parent_id is null
on conflict do nothing;

-- =========================================================
-- 4. Global System Merchants (Exact 6 Couriers + Business & Local Vendors)
-- =========================================================
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  -- Printing & Stationery
  (null, 'Satyam Xerox', 'satyamxerox', 'shopping', 'offline', true, array['satyam', 'yogesh bhai', 'satyam printing', 'xerox shop']),
  
  -- The exact 6 Couriers from your list
  (null, 'Shiprocket', 'shiprocket', 'delivery', 'online', true, array['ship rocket', 'shiprocket wallet']),
  (null, 'India Post', 'indiapost', 'delivery', 'offline', true, array['speed post', 'post office', 'dak', 'bharat post']),
  (null, 'Shree Mahavir', 'shreemahavir', 'delivery', 'offline', true, array['mahavir courier', 'shree mahavir courier', 'mahavir']),
  (null, 'Shree Nandan', 'shreenandan', 'delivery', 'offline', true, array['nandan courier', 'shree nandan courier', 'nandan']),
  (null, 'Shree Maruti', 'shreemaruti', 'delivery', 'offline', true, array['maruti courier', 'shree maruti courier', 'maruti']),
  (null, 'Porter', 'porter', 'delivery', 'online', true, array['porter tempo', 'porter delivery', 'porter app']),

  -- Homemade Business & Material Suppliers (Wholesale & Local)
  (null, 'LuxeKraft', 'luxekraft', 'shopping', 'mixed', true, array['luxe kraft', 'craft store', 'craft raw material']),
  (null, 'Mobile Wholesale Market', 'mobilewholesalemarket', 'shopping', 'offline', true, array['mobile market', 'cover market', 'relief road', 'wholesale cover shop', 'mobile covers']),
  (null, 'Roshni''s Mehndi Art', 'roshnimehndiart', 'shopping', 'mixed', true, array['roshni mehndi', 'mehndi raw material', 'mehndi art']),

  -- Local Food & Vendors
  (null, 'Local Farsan & Nasto Mart', 'localfarsannastomart', 'food', 'offline', true, array['nasto shop', 'farsan mart', 'khaman mart', 'local nasto']),
  (null, 'Local Kirana & Kariyana Store', 'localkiranakariyanastore', 'grocery', 'offline', true, array['kariyana shop', 'kirana store', 'local kariyana', 'ration shop']),
  (null, 'Local Bakery', 'localbakery', 'grocery', 'offline', true, array['bakery shop', 'pav shop', 'bread shop']),
  (null, 'Local Vendor', 'localvendor', 'other', 'offline', true, array['local shop', 'street vendor', 'local lari', 'vendor', 'wholesale vendor'])
on conflict (normalized_name) where household_id is null do nothing;

-- =========================================================
-- 5. Auto-link Merchants with their default Categories
-- =========================================================
update merchants m
set subcategory_id = c.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and (
    (m.normalized_name = 'satyamxerox' and p.name = 'Homemade Business' and c.name = 'Printing & Xerox')
    or (m.normalized_name in (
      'shiprocket', 'indiapost', 'shreemahavir', 'shreenandan', 'shreemaruti', 'porter'
    ) and p.name = 'Homemade Business' and c.name = 'Courier & Shipping')
    or (m.normalized_name in ('luxekraft', 'mobilewholesalemarket') and p.name = 'Homemade Business' and c.name = 'LuxeKraft')
    or (m.normalized_name = 'roshnimehndiart' and p.name = 'Homemade Business' and c.name = 'Roshni''s Mehndi Art')
    or (m.normalized_name = 'localfarsannastomart' and p.name = 'Food & Grocery' and c.name in ('Nasto & Farsan', 'Snacks'))
    or (m.normalized_name in ('localkiranakariyanastore', 'localvendor') and p.name = 'Food & Grocery' and c.name = 'Grocery')
    or (m.normalized_name = 'localbakery' and p.name = 'Food & Grocery' and c.name = 'Bakery')
  )
  and m.subcategory_id is null;

update merchants m
set category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null and m.subcategory_id = c.id and m.category_id is null;
