-- GharKharch: Gujarati Local Food, Snacks, Dairy, Shakbhaji & Household Rules (migration 034)
-- Adds comprehensive Subcategories, Merchants, Category Linking, and Smart Rules
-- for authentic Gujarati daily food life:
-- 1. Idli, Dosa, Uttapam, Meduvada (South Indian & Local Food)
-- 2. Khiru (Idli/Dhokla/Handvo batter)
-- 3. Paua, Cholafali, Khaman, Gathiya, Fafda, Dalvada (Nasto & Farsan)
-- 4. Pav Bhaji, Tawa Pulav, Masala Pav (Street Food)
-- 5. Manchurian, Chinese Bhel, Fried Rice (Local Chinese)
-- 6. Dabeli, Vada Pav, Chaat, Pani Puri, Sev Usal (Street Food)
-- 7. Dudh, Dahi, Chas, Paneer, Makhan, Shrikhand, Matho (Dairy / Amul)
-- 8. Local Sakbhaji / Shak Market (Bataka, Dungri, Tameta, Bhinda, etc.)
-- 9. Local Chai Kitli, Maska Bun, and Mithai

-- =========================================================
-- 1. Subcategories under "Food & Grocery"
-- =========================================================

insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'green', c.sort_order
from categories p, (values
  ('Street Food & Fast Food', 'utensils', 16),
  ('South Indian', 'circle-dot', 17),
  ('Nasto & Farsan', 'cookie', 14)
) as c(name, icon, sort_order)
where p.name = 'Food & Grocery' and p.household_id is null and p.parent_id is null
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active do nothing;

-- =========================================================
-- 2. Global System Merchants for Local Gujarati Food & Living
-- =========================================================

insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  -- South Indian Food Stall / Lari
  (null, 'Local South Indian & Dosa Centre', 'localsouthindiandosacentre', 'food', 'offline', true, array['dosa lari', 'dosa centre', 'dosa stall', 'south indian stall', 'idli sambhar stall', 'idli stall', 'uttapam stall', 'mysore dosa', 'jinny dosa', 'medu vada stall', 'south indian food', 'idli vendor']),

  -- Street Food, Pav Bhaji, Pulav
  (null, 'Local Street Food & Pav Bhaji Centre', 'localstreetfoodpavbhajicentre', 'food', 'offline', true, array['pav bhaji centre', 'pav bhaji stall', 'pau bhaji stall', 'honest', 'mahalaxmi pav bhaji', 'tawa pulav lari', 'masala pav stall', 'pulav centre', 'street food stall', 'pau bhaji']),

  -- Chinese & Manchurian
  (null, 'Local Chinese & Manchurian Corner', 'localchinesemanchuriancorner', 'food', 'offline', true, array['chinese thela', 'chinese corner', 'manchurian stall', 'chinese cart', 'local chinese', 'noodles stall', 'chinese bhel stall', 'schezwan cart', 'manchurian corner']),

  -- Dabeli & Vada Pav & Chaat
  (null, 'Local Dabeli & Vada Pav Stall', 'localdabelivadapavstall', 'food', 'offline', true, array['karnavati dabeli', 'kutchi dabeli stall', 'vada pav stall', 'vadapav centre', 'dabeli thela', 'bombay vadapav', 'puff center', 'aloo puff stall', 'dabeli stall', 'vadapav']),

  -- Khiru, Idli-Dhokla Batter & Dairy
  (null, 'Local Khiru & Dairy Centre', 'localkhirudairycentre', 'grocery', 'offline', true, array['khiru store', 'khiru shop', 'idli khiru shop', 'dhokla khiru', 'batter shop', 'shreenathji dairy', 'khiru centre', 'idli dosa batter', 'khiru vendor']),

  -- Shakbhaji & Vegetable Vendor (Local lari / thela)
  (null, 'Local Shakbhaji & Vegetable Vendor', 'localshakbhajivegetablevendor', 'grocery', 'offline', true, array['shakbhaji thela', 'sakbhaji lari', 'sabji wala', 'shak market', 'bhaji wala', 'green vegetable vendor', 'sak market', 'taja shakbhaji', 'shak lari', 'vegetable lari']),

  -- Local Mithai & Sweet Mart
  (null, 'Local Mithai & Sweet Mart', 'localmithaisweetmart', 'food', 'offline', true, array['sweet mart', 'mithai shop', 'kandoi', 'mohanthal', 'peda shop', 'shrikhand mart', 'jalebi mart', 'rasgulla shop', 'mithai mart']),

  -- Chai Kitli & Nasto
  (null, 'Local Chai & Nasto Kitli', 'localchainastokitli', 'food', 'offline', true, array['chai kitli', 'tea stall', 'tapri', 'chai nashto', 'tea point', 'maska bun stall', 'chai thela', 'kitli']),

  -- Pan & Cold Drinks
  (null, 'Local Pan & Cold Drinks Parlour', 'localpancolddrinksparlour', 'food', 'offline', true, array['pan parlor', 'paan shop', 'soda shop', 'cold drinks parlor', 'pan gallo', 'soda pub', 'gotilal soda'])
on conflict (normalized_name) where household_id is null do nothing;

-- =========================================================
-- 3. Link Merchants to Default Categories & Subcategories
-- =========================================================

update merchants m
set subcategory_id = c.id,
    category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and (
    (m.normalized_name = 'localsouthindiandosacentre' and p.name = 'Food & Grocery' and c.name = 'South Indian')
    or (m.normalized_name in ('localstreetfoodpavbhajicentre', 'localchinesemanchuriancorner', 'localdabelivadapavstall') and p.name = 'Food & Grocery' and c.name = 'Street Food & Fast Food')
    or (m.normalized_name = 'localkhirudairycentre' and p.name = 'Food & Grocery' and c.name = 'Grocery')
    or (m.normalized_name = 'localshakbhajivegetablevendor' and p.name = 'Food & Grocery' and c.name = 'Vegetables')
    or (m.normalized_name in ('localmithaisweetmart', 'localchainastokitli') and p.name = 'Food & Grocery' and c.name = 'Nasto & Farsan')
    or (m.normalized_name = 'localpancolddrinksparlour' and p.name = 'Food & Grocery' and c.name = 'Beverages')
  )
  and m.subcategory_id is null;

-- =========================================================
-- 4. Gujarati Local Food & Household Smart Automation Rules
-- =========================================================

-- 1. South Indian Food (Idli, Dosa, Uttapam, Meduvada)
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'South Indian Food (Idli, Dosa, Uttapam)',
  105,
  '{"keywords": ["idli", "dosa", "dhosa", "idli sambhar", "sambhar", "uttapam", "uttapa", "medu vada", "mysore masala", "jinny dosa", "cheese dosa", "south indian", "paper dosa", "rava dosa"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "South Indian", "merchant_name": "Local South Indian & Dosa Centre", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'South Indian Food (Idli, Dosa, Uttapam)' and household_id is null
);

-- 2. Khiru & Batter (Idli, Dhokla, Handvo, Khaman)
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Khiru & Batter (Idli, Dhokla, Handvo)',
  105,
  '{"keywords": ["khiru", "khiru batter", "idli khiru", "dhokla khiru", "khaman khiru", "handvo khiru", "idada khiru", "dosa batter", "idli batter", "batter packet"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Grocery", "merchant_name": "Local Khiru & Dairy Centre", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Khiru & Batter (Idli, Dhokla, Handvo)' and household_id is null
);

-- 3. Gujarati Nasto & Farsan (Paua, Cholafali, Gathiya, Khaman)
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Gujarati Nasto & Farsan (Paua, Cholafali, Gathiya)',
  105,
  '{"keywords": ["paua", "bataka paua", "pauva", "poha", "cholafali", "chora fali", "khaman", "dhokla", "gathiya", "fafda", "locho", "dalvada", "bhajiya", "methi gota", "khandvi", "patra", "khakhra", "thepla", "muthia", "sev khamani", "amiri khaman", "farsan", "nasto", "nashto", "samosa", "kachori", "lilva kachori"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Nasto & Farsan", "merchant_name": "Local Farsan & Nasto Mart", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Gujarati Nasto & Farsan (Paua, Cholafali, Gathiya)' and household_id is null
);

-- 4. Pav Bhaji & Tawa Pulav
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Pav Bhaji & Tawa Pulav',
  105,
  '{"keywords": ["pav bhaji", "pavbhaji", "pao bhaji", "pau bhaji", "pulav", "pulao", "tawa pulav", "masala pav", "cheese pav bhaji", "bhaji pav"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Street Food & Fast Food", "merchant_name": "Local Street Food & Pav Bhaji Centre", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Pav Bhaji & Tawa Pulav' and household_id is null
);

-- 5. Manchurian & Chinese Fast Food
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Manchurian & Chinese Fast Food',
  105,
  '{"keywords": ["manchurian", "manchuriyan", "dry manchurian", "chinese bhel", "fried rice", "hakka noodles", "chowmein", "schezwan rice", "spring roll", "chinese", "manchurian noodles"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Street Food & Fast Food", "merchant_name": "Local Chinese & Manchurian Corner", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Manchurian & Chinese Fast Food' and household_id is null
);

-- 6. Dabeli, Vada Pav, Chaat & Street Food
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Dabeli, Vada Pav, Chaat & Street Food',
  105,
  '{"keywords": ["dabeli", "kutchi dabeli", "vadapav", "vada pav", "ulta vadapav", "pani puri", "panipuri", "sev puri", "dahi puri", "ragda patties", "sev usal", "bhel", "chaat", "frankie", "sandwich", "maska bun", "puff", "aloo puff", "cheese puff"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Street Food & Fast Food", "merchant_name": "Local Dabeli & Vada Pav Stall", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Dabeli, Vada Pav, Chaat & Street Food' and household_id is null
);

-- 7. Dudh, Dahi, Chas & Dairy (Amul)
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Dudh, Dahi, Chas & Dairy (Amul)',
  105,
  '{"keywords": ["dudh", "doodh", "amul milk", "amul gold", "amul taaza", "amul shakti", "dahi", "curd", "chas", "chaas", "chhaas", "buttermilk", "masala chas", "paneer", "makhan", "butter", "amul butter", "shrikhand", "matho", "basundi", "lassi", "malai", "ghee", "amul ghee", "amul masti dahi"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Dairy", "merchant_name": "Amul Parlour", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Dudh, Dahi, Chas & Dairy (Amul)' and household_id is null
);

-- 8. Local Sakbhaji & Fresh Vegetables (Comprehensive Gujarati Produce)
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Local Sakbhaji & Fresh Vegetables',
  105,
  '{"keywords": ["sakbhaji", "shakbhaji", "shak", "shaak", "sabji mandi", "shak thela", "sak lari", "bataka", "batata", "dungri", "kanda", "tameta", "bhinda", "ringna", "dudhi", "karela", "galka", "turiya", "tindora", "guvar", "kothmir", "marcha", "adu", "lasan", "limbu", "palak", "methi bhaji", "flower", "kobi", "vatana", "tuver", "surti papdi", "valor", "choli", "mogri", "parwal", "kakdi"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Vegetables", "merchant_name": "Local Shakbhaji & Vegetable Vendor", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Local Sakbhaji & Fresh Vegetables' and household_id is null
);

-- 9. Chai Kitli & Nasto Break
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Chai Kitli & Nasto Break',
  105,
  '{"keywords": ["chai", "chaha", "tea stall", "kitli", "chai nashto", "cutting chai", "tea break", "tea point", "tapri"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Nasto & Farsan", "merchant_name": "Local Chai & Nasto Kitli", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Chai Kitli & Nasto Break' and household_id is null
);

-- 10. Mithai & Traditional Sweets
insert into automation_rules (household_id, name, priority, conditions, actions)
select
  null,
  'Mithai & Traditional Sweets',
  105,
  '{"keywords": ["mithai", "sweets", "mohanthal", "peda", "kaju katli", "gulab jamun", "rasgulla", "barfi", "kandoi", "magas", "halwasan", "mesub", "sweet mart"], "entry_type": "expense"}'::jsonb,
  '{"category_name": "Food & Grocery", "subcategory_name": "Nasto & Farsan", "merchant_name": "Local Mithai & Sweet Mart", "payment_method": "UPI"}'::jsonb
where not exists (
  select 1 from automation_rules where name = 'Mithai & Traditional Sweets' and household_id is null
);
