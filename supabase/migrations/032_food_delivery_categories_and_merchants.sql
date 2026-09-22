-- GharKharch: Food Delivery subcategory, Fast Food & Pizza merchants, and Smart Rules.
-- Re-maps Swiggy & Zomato from Entertainment -> Dining Out to Food & Grocery -> Food Delivery.

-- =========================================================
-- 1. Add "Food Delivery" subcategory under "Food & Grocery"
-- =========================================================
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'green', c.sort_order
from categories p, (values
  ('Food Delivery', 'utensils', 15)
) as c(name, icon, sort_order)
where p.name = 'Food & Grocery' and p.household_id is null and p.parent_id is null
on conflict do nothing;

-- =========================================================
-- 2. Global Merchants (Food Delivery & Pizza / Fast Food Brands)
-- =========================================================
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  (null, 'Domino''s Pizza',     'dominospizza',     'food', 'mixed', true, array['dominos', 'domino''s', 'dominos pizza', 'domino']),
  (null, 'McDonald''s',         'mcdonalds',         'food', 'mixed', true, array['mcd', 'mcdonalds', 'mcdonald', 'mc donalds', 'mcdonald''s']),
  (null, 'La Pino''z Pizza',    'lapinozpizza',     'food', 'mixed', true, array['la pinoz', 'la pino''z', 'lapinoz', 'lapinos', 'la pinoz pizza', 'la pino''z pizza']),
  (null, 'La Milano Pizzeria',  'lamilanopizzeria',  'food', 'mixed', true, array['la milano', 'lamilano', 'la milano pizzeria', 'la milano pizza']),
  (null, 'Burger King',         'burgerking',        'food', 'mixed', true, array['burger king', 'bk']),
  (null, 'Subway',              'subway',            'food', 'mixed', true, array['subway']),
  (null, 'Pizza Hut',           'pizzahut',          'food', 'mixed', true, array['pizza hut']),
  (null, 'KFC',                 'kfc',               'food', 'mixed', true, array['kfc', 'kentucky fried chicken'])
on conflict (normalized_name) where household_id is null do nothing;

-- =========================================================
-- 3. Link Food Delivery & Pizza Brands to Food & Grocery -> Food Delivery
-- =========================================================
update merchants m
set subcategory_id = c.id,
    category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and m.normalized_name in (
    'swiggy',
    'zomato',
    'dominospizza',
    'mcdonalds',
    'lapinozpizza',
    'lamilanopizzeria',
    'burgerking',
    'subway',
    'pizzahut',
    'kfc'
  )
  and p.name = 'Food & Grocery'
  and p.household_id is null
  and c.name = 'Food Delivery';

-- =========================================================
-- 4. Update Automation Rules for Food Delivery
-- =========================================================
update automation_rules
set actions = jsonb_set(
      jsonb_set(actions, '{category_name}', '"Food & Grocery"'),
      '{subcategory_name}', '"Food Delivery"'
    ),
    conditions = '{"keywords": ["zomato", "swiggy", "eatclub", "mcdonalds", "dominos", "pizza", "burger", "la pinoz", "la milano", "burger king", "kfc", "subway", "pizza hut", "food delivery"], "entry_type": "expense"}'::jsonb
where name = 'Food Delivery & Takeaway';
