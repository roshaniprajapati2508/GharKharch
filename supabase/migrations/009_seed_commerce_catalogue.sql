-- GharKharch: seed the system-wide (global, household_id null) commerce catalogue.
-- Everything here is a starting point, not a hard-coded requirement - every
-- household can rename, deactivate, or add their own on top (spec addendum
-- sections 3-9, 16, 28-32, 45).

-- =========================================================
-- System merchants - quick commerce / grocery delivery
-- =========================================================
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  (null, 'Zepto',              'zepto',              'grocery',  'online', true, array[]::text[]),
  (null, 'Blinkit',            'blinkit',             'grocery',  'online', true, array['grofers']),
  (null, 'Swiggy Instamart',   'swiggyinstamart',    'grocery',  'online', true, array['instamart', 'insta']),
  (null, 'BigBasket',          'bigbasket',          'grocery',  'online', true, array['bb']),
  (null, 'JioMart',            'jiomart',            'grocery',  'online', true, array[]::text[]),
  (null, 'DMart',              'dmart',              'grocery',  'offline', true, array['d mart', 'dmart ready']),
  (null, 'Flipkart Minutes',   'flipkartminutes',    'grocery',  'online', true, array[]::text[]),
  (null, 'Amazon Fresh',       'amazonfresh',        'grocery',  'online', true, array[]::text[]),
-- Food delivery
  (null, 'Swiggy',             'swiggy',             'food',     'online', true, array[]::text[]),
  (null, 'Zomato',             'zomato',             'food',     'online', true, array[]::text[]),
-- Shopping / marketplaces
  (null, 'Amazon',             'amazon',             'marketplace', 'online', true, array[]::text[]),
  (null, 'Flipkart',           'flipkart',           'marketplace', 'online', true, array[]::text[]),
  (null, 'Myntra',             'myntra',             'shopping', 'online', true, array[]::text[]),
  (null, 'Ajio',               'ajio',               'shopping', 'online', true, array[]::text[]),
  (null, 'Tata CLiQ',          'tatacliq',           'shopping', 'online', true, array[]::text[]),
  (null, 'Meesho',             'meesho',             'shopping', 'online', true, array[]::text[]),
  (null, 'Nykaa',              'nykaa',              'shopping', 'online', true, array[]::text[]),
  (null, 'Reliance Digital',   'reliancedigital',    'electronics', 'offline', true, array[]::text[]),
  (null, 'Croma',              'croma',              'electronics', 'offline', true, array[]::text[]),
  (null, 'Vijay Sales',        'vijaysales',         'electronics', 'offline', true, array[]::text[]),
  (null, 'Reliance Trends',    'reliancetrends',     'fashion',  'offline', true, array[]::text[]),
  (null, 'Reliance Smart',     'reliancesmart',      'grocery',  'offline', true, array[]::text[]),
  (null, 'Zudio',              'zudio',              'fashion',  'offline', true, array[]::text[]),
-- Entertainment
  (null, 'BookMyShow',         'bookmyshow',         'movies',   'online', true, array['bms']),
  (null, 'District',           'district',           'movies',   'online', true, array[]::text[]),
  (null, 'PVR INOX',           'pvrinox',            'movies',   'offline', true, array['pvr', 'inox']),
  (null, 'Cinepolis',          'cinepolis',          'movies',   'offline', true, array[]::text[]),
-- Cabs / travel
  (null, 'Uber',               'uber',               'travel',   'online', true, array[]::text[]),
  (null, 'Ola',                'ola',                'travel',   'online', true, array[]::text[]),
-- Ads
  (null, 'Google Ads',         'googleads',          'advertising', 'online', true, array['adwords'])
on conflict (normalized_name) where household_id is null do nothing;

-- Map the merchants above to a sensible global category/subcategory where an
-- obvious one exists in the 004 seed tree (best-effort; harmless if a name
-- doesn't match - the merchant is still created, just without a category).
update merchants m
set subcategory_id = c.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and (
    (m.normalized_name in ('zepto','blinkit','swiggyinstamart','bigbasket','jiomart','dmart','flipkartminutes','amazonfresh') and p.name = 'Food & Grocery' and c.name = 'Grocery')
    or (m.normalized_name in ('swiggy','zomato') and p.name = 'Entertainment' and c.name = 'Dining Out')
    or (m.normalized_name in ('amazon','flipkart','meesho') and p.name = 'Shopping' and c.name = 'Online Shopping')
    or (m.normalized_name in ('myntra','ajio','tatacliq','nykaa','reliancetrends','zudio') and p.name = 'Fashion' and c.name = 'Clothing')
    or (m.normalized_name in ('reliancedigital','croma','vijaysales') and p.name = 'Electronics' and c.name = 'Electronics')
    or (m.normalized_name in ('bookmyshow','district','pvrinox','cinepolis') and p.name = 'Entertainment' and c.name = 'Movies')
    or (m.normalized_name in ('uber','ola') and p.name = 'Transport' and c.name = 'Cab')
    or (m.normalized_name = 'reliancesmart' and p.name = 'Food & Grocery' and c.name = 'Grocery')
    or (m.normalized_name = 'googleads' and p.name = 'Personal' and c.name = 'Advertising & Marketing')
  )
  and m.subcategory_id is null;

update merchants m
set category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null and m.subcategory_id = c.id and m.category_id is null;

-- =========================================================
-- Card issuers + a handful of well-known products per issuer
-- =========================================================
insert into card_issuers (name) values
  ('HDFC Bank'), ('ICICI Bank'), ('State Bank of India'), ('Axis Bank'),
  ('Kotak Mahindra Bank'), ('IDFC FIRST Bank'), ('American Express'), ('Other')
on conflict (name) do nothing;

insert into card_products (issuer_id, name, variant, network, card_type)
select i.id, v.name, v.variant, v.network, v.card_type
from card_issuers i
join (values
  ('HDFC Bank', 'Regalia', 'Gold', 'visa', 'credit'),
  ('HDFC Bank', 'Millennia', null, 'visa', 'credit'),
  ('HDFC Bank', 'Infinia', null, 'visa', 'credit'),
  ('ICICI Bank', 'Amazon Pay', null, 'visa', 'credit'),
  ('ICICI Bank', 'Coral', null, 'visa', 'credit'),
  ('ICICI Bank', 'Sapphiro', null, 'visa', 'credit'),
  ('State Bank of India', 'Cashback', null, 'mastercard', 'credit'),
  ('State Bank of India', 'SimplyCLICK', null, 'mastercard', 'credit'),
  ('Axis Bank', 'ACE', null, 'visa', 'credit'),
  ('Axis Bank', 'Magnus', null, 'visa', 'credit'),
  ('Axis Bank', 'Airtel', null, 'rupay', 'credit')
) as v(issuer_name, name, variant, network, card_type) on i.name = v.issuer_name
on conflict (issuer_id, name, variant) do nothing;

-- =========================================================
-- Bill providers (system, global) - Gujarat-relevant + national
-- =========================================================
insert into bill_providers (household_id, name, provider_type, state, is_system) values
  (null, 'UGVCL', 'electricity', 'Gujarat', true),
  (null, 'PGVCL', 'electricity', 'Gujarat', true),
  (null, 'DGVCL', 'electricity', 'Gujarat', true),
  (null, 'MGVCL', 'electricity', 'Gujarat', true),
  (null, 'Torrent Power', 'electricity', 'Gujarat', true),
  (null, 'Other Electricity Provider', 'electricity', null, true),
  (null, 'Bharatgas', 'gas', null, true),
  (null, 'HP Gas', 'gas', null, true),
  (null, 'Indane', 'gas', null, true),
  (null, 'Other Gas Provider', 'gas', null, true),
  (null, 'Municipal Water', 'water', null, true),
  (null, 'Society Water', 'water', null, true),
  (null, 'Other Water Provider', 'water', null, true),
  (null, 'Jio', 'internet', null, true),
  (null, 'Airtel', 'internet', null, true),
  (null, 'Vi', 'internet', null, true),
  (null, 'BSNL', 'internet', null, true),
  (null, 'Other Internet Provider', 'internet', null, true),
  (null, 'Jio', 'mobile', null, true),
  (null, 'Airtel', 'mobile', null, true),
  (null, 'Vi', 'mobile', null, true),
  (null, 'BSNL', 'mobile', null, true),
  (null, 'Other Mobile Provider', 'mobile', null, true),
  (null, 'Tata Play', 'dth', null, true),
  (null, 'Dish TV', 'dth', null, true),
  (null, 'Other DTH Provider', 'dth', null, true),
  (null, 'Society Maintenance', 'maintenance', null, true)
on conflict (name, provider_type) where household_id is null do nothing;
