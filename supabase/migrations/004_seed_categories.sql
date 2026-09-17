-- GharKharch: default (global) category tree.
-- household_id is null => visible to every household, but never editable by them.
-- Households can add their own categories (household_id set) alongside these.
--
-- KNOWN HISTORICAL BUG (fixed by 011_dedup_and_merge.sql): only the top-level
-- category insert below has an `on conflict do nothing` guard — every
-- subcategory insert does not. If this file is ever run twice against the
-- same database, every subcategory doubles. Migration 011 cleans up any
-- existing duplicates this caused and adds a scoped unique index
-- (idx_categories_unique_scope) so a second run of this file now fails loudly
-- instead of silently duplicating. Do not run this file more than once.

insert into categories (household_id, parent_id, name, icon, color, sort_order) values
  (null, null, 'Food & Grocery',   'shopping-basket', 'green',  10),
  (null, null, 'Shopping',         'shopping-bag',    'pink',   20),
  (null, null, 'Fashion',          'shirt',           'purple', 30),
  (null, null, 'Electronics',      'smartphone',      'blue',   40),
  (null, null, 'Household',        'home',            'amber',  50),
  (null, null, 'Transport',        'car',             'orange', 60),
  (null, null, 'Health',           'heart-pulse',      'red',    70),
  (null, null, 'Personal',         'user',            'teal',   80),
  (null, null, 'Entertainment',    'film',            'indigo', 90),
  (null, null, 'Bills & Utilities','receipt',         'slate',  100)
on conflict do nothing;

-- Food & Grocery
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'green', c.sort_order
from categories p, (values
  ('Milk', 'milk', 1), ('Curd', 'circle-dot', 2), ('Buttermilk', 'glass-water', 3),
  ('Paneer', 'square', 4), ('Dairy', 'milk', 5), ('Vegetables', 'carrot', 6),
  ('Fruits', 'apple', 7), ('Grocery', 'shopping-basket', 8), ('Snacks', 'cookie', 9),
  ('Beverages', 'cup-soda', 10), ('Bakery', 'croissant', 11), ('Meat', 'drumstick', 12),
  ('Other', 'ellipsis', 13)
) as c(name, icon, sort_order)
where p.name = 'Food & Grocery' and p.household_id is null and p.parent_id is null;

-- Shopping
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'pink', c.sort_order
from categories p, (values
  ('General Shopping', 'shopping-bag', 1),
  ('Online Shopping', 'package', 2),
  ('Household Shopping', 'shopping-cart', 3)
) as c(name, icon, sort_order)
where p.name = 'Shopping' and p.household_id is null and p.parent_id is null;

-- Fashion
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'purple', c.sort_order
from categories p, (values
  ('Clothing', 'shirt', 1), ('Shoes', 'footprints', 2), ('Accessories', 'watch', 3),
  ('Zudio', 'shirt', 4), ('Cosmetics', 'sparkles', 5), ('Grooming', 'scissors', 6)
) as c(name, icon, sort_order)
where p.name = 'Fashion' and p.household_id is null and p.parent_id is null;

-- Electronics
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'blue', c.sort_order
from categories p, (values
  ('Mobile', 'smartphone', 1), ('Laptop', 'laptop', 2), ('Accessories', 'cable', 3),
  ('Croma', 'plug', 4), ('Appliances', 'washing-machine', 5), ('Electronics', 'cpu', 6)
) as c(name, icon, sort_order)
where p.name = 'Electronics' and p.household_id is null and p.parent_id is null;

-- Household
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'amber', c.sort_order
from categories p, (values
  ('Cleaning', 'spray-can', 1), ('Kitchen', 'utensils-crossed', 2), ('Furniture', 'sofa', 3),
  ('Home Decor', 'lamp', 4), ('Utilities', 'plug-zap', 5), ('Maintenance', 'wrench', 6)
) as c(name, icon, sort_order)
where p.name = 'Household' and p.household_id is null and p.parent_id is null;

-- Transport
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'orange', c.sort_order
from categories p, (values
  ('Petrol', 'fuel', 1), ('Diesel', 'fuel', 2), ('EV Charging', 'battery-charging', 3),
  ('Auto', 'car-taxi-front', 4), ('Cab', 'car', 5), ('Bus', 'bus', 6),
  ('Train', 'train-front', 7), ('Parking', 'parking-circle', 8), ('Toll', 'road', 9)
) as c(name, icon, sort_order)
where p.name = 'Transport' and p.household_id is null and p.parent_id is null;

-- Health
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'red', c.sort_order
from categories p, (values
  ('Medicine', 'pill', 1), ('Doctor', 'stethoscope', 2), ('Pharmacy', 'cross', 3),
  ('Dental', 'smile', 4), ('Tests', 'test-tube', 5), ('Fitness', 'dumbbell', 6)
) as c(name, icon, sort_order)
where p.name = 'Health' and p.household_id is null and p.parent_id is null;

-- Personal
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'teal', c.sort_order
from categories p, (values
  ('Grooming', 'scissors', 1), ('Personal Care', 'heart', 2),
  ('Hobbies', 'palette', 3), ('Miscellaneous', 'ellipsis', 4)
) as c(name, icon, sort_order)
where p.name = 'Personal' and p.household_id is null and p.parent_id is null;

-- Entertainment
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'indigo', c.sort_order
from categories p, (values
  ('Movies', 'clapperboard', 1), ('OTT', 'tv', 2), ('Games', 'gamepad-2', 3),
  ('Events', 'ticket', 4), ('Dining Out', 'utensils', 5)
) as c(name, icon, sort_order)
where p.name = 'Entertainment' and p.household_id is null and p.parent_id is null;

-- Bills & Utilities
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'slate', c.sort_order
from categories p, (values
  ('Electricity', 'zap', 1), ('Gas', 'flame', 2), ('Water', 'droplets', 3),
  ('Internet', 'wifi', 4), ('Mobile', 'smartphone', 5), ('DTH', 'satellite-dish', 6)
) as c(name, icon, sort_order)
where p.name = 'Bills & Utilities' and p.household_id is null and p.parent_id is null;
