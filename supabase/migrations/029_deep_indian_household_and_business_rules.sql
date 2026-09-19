-- GharKharch: Deep Master Expansion for Indian Household & Homemade Business (migration 029)
-- Adds comprehensive Subcategories, Merchants, Auto-linking, and Smart Rules
-- specifically tailored for daily Indian household life and Homemade Business operations.

-- =========================================================
-- 1. New Subcategories
-- =========================================================

-- Under Household: Maid & Domestic Help, Pooja & Spiritual, Society Maintenance
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, c.name, c.icon, 'amber', c.sort_order
from categories p, (values
  ('Maid & Domestic Help', 'users', 7),
  ('Pooja & Spiritual', 'flower-2', 8),
  ('Society Maintenance', 'building', 9)
) as c(name, icon, sort_order)
where p.name = 'Household' and p.household_id is null and p.parent_id is null
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active do nothing;

-- Under Personal: Education & Tuition
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, 'Education & Tuition', 'graduation-cap', 'teal', 5
from categories p
where p.name = 'Personal' and p.household_id is null and p.parent_id is null
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active do nothing;

-- Under Homemade Business: Packaging & Shipping Supplies
insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, 'Packaging & Shipping Supplies', 'package', 'indigo', 8
from categories p
where p.name = 'Homemade Business' and p.household_id is null and p.parent_id is null
on conflict (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(name))
) where is_active do nothing;

-- =========================================================
-- 2. Global System Merchants
-- =========================================================
insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, aliases) values
  -- Domestic Services & Household
  (null, 'Urban Company', 'urbancompany', 'other', 'online', true, array['urban clap', 'urbancompany', 'uc home service', 'ac service']),
  (null, 'House Maid', 'housemaid', 'other', 'offline', true, array['maid', 'kamvali', 'bai', 'safai wali', 'cleaning lady']),
  (null, 'Cook / Maharaj', 'cookmaharaj', 'food', 'offline', true, array['cook', 'maharaj', 'rasoiya', 'kitchen cook']),
  (null, 'Local Pooja & Phool Bhandar', 'localpoojaphoolbhandar', 'shopping', 'offline', true, array['phool wala', 'pooja shop', 'agarbatti store', 'mandir phool']),
  (null, 'Society Office / RWA', 'societyofficerwa', 'utility', 'offline', true, array['society maintenance', 'rwa maintenance', 'building maintenance']),
  
  -- Supermarkets, Dairy & Grocery
  (null, 'D-Mart', 'dmart', 'grocery', 'offline', true, array['d mart', 'dmart ready', 'avenue supermarts']),
  (null, 'Amul Parlour', 'amulparlour', 'grocery', 'offline', true, array['amul', 'amul dairy', 'amul milk', 'amul booth']),
  (null, 'Reliance Smart / Fresh', 'reliancesmartfresh', 'grocery', 'offline', true, array['reliance smart', 'reliance fresh', 'smart bazaar']),
  (null, 'JioMart', 'jiomart', 'grocery', 'online', true, array['jio mart', 'jiomart online']),
  (null, 'Local Sabji Mandi', 'localsabjimandi', 'grocery', 'offline', true, array['sabji mandi', 'sabji thela', 'vegetable market', 'bhaji market']),
  (null, 'Local Fruit Vendor', 'localfruitvendor', 'grocery', 'offline', true, array['fruit thela', 'fruit shop', 'fal market']),

  -- Pharmacy & Medical
  (null, 'Apollo Pharmacy', 'apollopharmacy', 'pharmacy', 'mixed', true, array['apollo 247', 'apollo chemist']),
  (null, 'Tata 1mg', 'tata1mg', 'pharmacy', 'online', true, array['1mg', 'tata 1mg pharmacy']),
  (null, 'Netmeds', 'netmeds', 'pharmacy', 'online', true, array['net meds']),
  (null, 'Local Medical Store', 'localmedicalstore', 'pharmacy', 'offline', true, array['chemist', 'medical store', 'dawa shop', 'pharmacy shop']),

  -- Fuel & Travel
  (null, 'Indian Oil / HP / BPCL', 'indianoilhpbpcl', 'fuel', 'offline', true, array['petrol pump', 'hp petrol', 'indian oil', 'bpcl', 'cng station', 'cng pump']),

  -- Business Logistics & Marketing
  (null, 'Packaging Supplies Vendor', 'packagingsuppliesvendor', 'shopping', 'mixed', true, array['box supplier', 'bubble wrap vendor', 'packing box', 'corrugated box']),
  (null, 'Delhivery', 'delhivery', 'delivery', 'mixed', true, array['delhivery courier', 'delhivery surface']),
  (null, 'DTDC', 'dtdc', 'delivery', 'mixed', true, array['dtdc courier', 'dtdc express']),
  (null, 'Google Ads', 'googleads', 'advertising', 'online', true, array['adwords', 'google advertisement']),
  
  -- Education & Tuition
  (null, 'Tuition / Coaching Classes', 'tuitioncoachingclasses', 'other', 'offline', true, array['tuition fee', 'coaching fee', 'classes fee', 'tutor'])
on conflict (normalized_name) where household_id is null do nothing;

-- =========================================================
-- 3. Auto-link Merchants to Default Categories & Subcategories
-- =========================================================
update merchants m
set subcategory_id = c.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null
  and (
    -- Household
    (m.normalized_name in ('housemaid', 'cookmaharaj') and p.name = 'Household' and c.name = 'Maid & Domestic Help')
    or (m.normalized_name = 'localpoojaphoolbhandar' and p.name = 'Household' and c.name = 'Pooja & Spiritual')
    or (m.normalized_name = 'societyofficerwa' and p.name = 'Household' and c.name = 'Society Maintenance')
    or (m.normalized_name = 'urbancompany' and p.name = 'Household' and c.name = 'Maintenance')
    
    -- Food & Grocery
    (m.normalized_name in ('dmart', 'reliancesmartfresh', 'jiomart') and p.name = 'Food & Grocery' and c.name = 'Grocery')
    or (m.normalized_name = 'amulparlour' and p.name = 'Food & Grocery' and c.name = 'Milk')
    or (m.normalized_name = 'localsabjimandi' and p.name = 'Food & Grocery' and c.name = 'Vegetables')
    or (m.normalized_name = 'localfruitvendor' and p.name = 'Food & Grocery' and c.name = 'Fruits')

    -- Health
    or (m.normalized_name in ('apollopharmacy', 'tata1mg', 'netmeds', 'localmedicalstore') and p.name = 'Health' and c.name = 'Medicine')

    -- Transport
    or (m.normalized_name = 'indianoilhpbpcl' and p.name = 'Transport' and c.name = 'Petrol')

    -- Homemade Business
    or (m.normalized_name = 'packagingsuppliesvendor' and p.name = 'Homemade Business' and c.name = 'Packaging & Shipping Supplies')
    or (m.normalized_name in ('delhivery', 'dtdc') and p.name = 'Homemade Business' and c.name = 'Courier & Shipping')
    or (m.normalized_name = 'googleads' and p.name = 'Homemade Business' and c.name = 'Advertising & Marketing')

    -- Personal / Education
    or (m.normalized_name = 'tuitioncoachingclasses' and p.name = 'Personal' and c.name = 'Education & Tuition')
  )
  and m.subcategory_id is null;

update merchants m
set category_id = p.id
from categories c
join categories p on p.id = c.parent_id
where m.household_id is null and m.subcategory_id = c.id and m.category_id is null;

-- =========================================================
-- 4. Deep Master Smart Rules (IFTTT Automation Engine)
-- =========================================================
insert into automation_rules (household_id, name, priority, conditions, actions)
values
  -- 1. Domestic Help & Maid
  (null, 'Maid & Domestic Help', 100,
    '{"keywords": ["maid", "kamvali", "bai", "cook", "maharaj", "car wash", "dhobi", "safai", "sweeper", "cleaning lady"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Household", "subcategory_name": "Maid & Domestic Help", "merchant_name": "House Maid", "paid_by_name": "Harsh", "payment_method": "Cash"}'::jsonb),

  -- 2. Pooja & Religious Offerings
  (null, 'Pooja & Spiritual Items', 100,
    '{"keywords": ["pooja", "puja", "agarbatti", "dhoop", "diya oil", "phool", "prasad", "mandir", "daan", "temple", "pooja samagri", "havan"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Household", "subcategory_name": "Pooja & Spiritual", "merchant_name": "Local Pooja & Phool Bhandar", "payment_method": "Cash"}'::jsonb),

  -- 3. Society Maintenance & Building Charges
  (null, 'Society Maintenance', 100,
    '{"keywords": ["society maintenance", "maintenance fee", "maintenance bill", "society bill", "rwa bill", "building maintenance"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Household", "subcategory_name": "Society Maintenance", "merchant_name": "Society Office / RWA", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb),

  -- 4. Supermarket Grocery & Monthly Ration
  (null, 'Supermarket & Ration Grocery', 100,
    '{"keywords": ["dmart", "d-mart", "d mart", "reliance smart", "smart bazaar", "jiomart", "kirana", "kariyana", "ration", "tel dabba", "atta dabba", "oil tin"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Grocery", "merchant_name": "D-Mart", "payment_method": "UPI"}'::jsonb),

  -- 5. Sabji Mandi & Fresh Produce
  (null, 'Sabji Mandi & Vegetables', 100,
    '{"keywords": ["sabji", "bhaji", "tameta", "bataka", "dungri", "kanda", "aloo", "onion", "tomato", "palak", "bhindi", "mandi", "vegetables"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Vegetables", "merchant_name": "Local Sabji Mandi", "payment_method": "UPI"}'::jsonb),

  -- 6. Fresh Fruits Market
  (null, 'Fresh Fruits', 100,
    '{"keywords": ["fruits", "kela", "banana", "seb", "apple", "keri", "mango", "chiku", "papaya", "grapes", "fruit vendor"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Fruits", "merchant_name": "Local Fruit Vendor", "payment_method": "UPI"}'::jsonb),

  -- 7. Pharmacy & Medicines
  (null, 'Pharmacy & Medicines', 100,
    '{"keywords": ["medicine", "tablet", "syrup", "apollo pharmacy", "1mg", "netmeds", "pharmeasy", "medical store", "chemist", "dawa", "capsule", "painkiller"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Health", "subcategory_name": "Medicine", "merchant_name": "Local Medical Store", "payment_method": "UPI"}'::jsonb),

  -- 8. Doctor & Clinic Consultation
  (null, 'Doctor & Lab Tests', 100,
    '{"keywords": ["doctor", "clinic", "consultation fee", "pathology", "lab test", "blood test", "xray", "hospital", "dentist", "dental"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Health", "subcategory_name": "Doctor", "payment_method": "UPI"}'::jsonb),

  -- 9. Education & Tuition Fees
  (null, 'Education & Tuition', 100,
    '{"keywords": ["tuition", "coaching", "school fee", "college fee", "class fee", "exam fee", "tuition fee", "course fee"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Personal", "subcategory_name": "Education & Tuition", "merchant_name": "Tuition / Coaching Classes", "payment_method": "UPI"}'::jsonb),

  -- 10. Packaging Boxes & Shipping Supplies (Business)
  (null, 'Business Packaging Supplies', 100,
    '{"keywords": ["corrugated box", "bubble wrap", "courier bag", "packing tape", "brown tape", "shipping label", "fragile tape", "packaging box", "packaging material"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Packaging & Shipping Supplies", "merchant_name": "Packaging Supplies Vendor", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb),

  -- 11. Roshni Mehndi Art Supplies & Oils
  (null, 'Mehndi Henna & Oils', 100,
    '{"keywords": ["henna powder", "sojat", "nilgiri oil", "eucalyptus oil", "cajeput", "acrylic practice hand", "mehndi cone", "cone sheet", "cello cone", "cone rolling"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Roshni''s Mehndi Art", "merchant_name": "Roshni''s Mehndi Art", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb),

  -- 12. LuxeKraft Blank Covers & Acrylics
  (null, 'LuxeKraft Blank Covers & Raw Material', 100,
    '{"keywords": ["blank cover", "blank case", "sublimation case", "acrylic cover", "phone cover stock", "relief road", "luxekraft stock", "resin", "epoxy"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "LuxeKraft", "merchant_name": "Mobile Wholesale Market", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb),

  -- 13. Delhivery, DTDC & Express Couriers
  (null, 'Express Couriers & Parcels', 100,
    '{"keywords": ["delhivery", "dtdc", "bluedart", "express courier", "parcel booking"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Courier & Shipping", "merchant_name": "Delhivery", "payment_method": "UPI"}'::jsonb),

  -- 14. Google Ads & Online Marketing
  (null, 'Google Ads & Digital Marketing', 100,
    '{"keywords": ["google ads", "adwords", "google advertisement", "ad campaign"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Advertising & Marketing", "merchant_name": "Google Ads", "paid_by_name": "Harsh", "payment_method": "Card"}'::jsonb),

  -- 15. Urban Company Home Services
  (null, 'Urban Company Home Services', 100,
    '{"keywords": ["urban company", "urbanclap", "ac service", "plumber service", "deep cleaning", "pest control"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Household", "subcategory_name": "Maintenance", "merchant_name": "Urban Company", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb),

  -- 16. Bridal Mehndi Client Advance / Income
  (null, 'Bridal Mehndi Booking Advance', 100,
    '{"keywords": ["bridal mehndi booking", "mehndi booking", "mehndi client advance", "henna client payment"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Business Sales & Payouts", "paid_by_name": "Roshni", "payment_method": "UPI"}'::jsonb)
on conflict do nothing;
