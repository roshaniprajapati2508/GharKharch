-- GharKharch: Seed 10 Expanded Smart Rules (migration 028)
-- Provides instant auto-fill for Business Ad spend & stock, Quick Commerce,
-- Food delivery, Fresh produce, Utilities, Subscriptions, and Cabs.

insert into automation_rules (household_id, name, priority, conditions, actions)
values
  -- 1. Business Ad spend & promotion
  (null, 'Meta & Online Ads', 100,
    '{"keywords": ["meta ads", "facebook ads", "instagram ads", "fb ads", "google ads", "ad spend", "advertisement"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Advertising & Marketing", "merchant_name": "Meta Ads", "payment_method": "UPI"}'::jsonb),

  -- 2. LuxeKraft mobile covers inventory
  (null, 'Mobile Cover Stock', 100,
    '{"keywords": ["mobile cover", "phone cover", "blank cover", "cover stock", "acrylic cover", "relief road cover"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "LuxeKraft", "merchant_name": "Mobile Wholesale Market", "paid_by_name": "Harsh"}'::jsonb),

  -- 3. Business tools & website hosting
  (null, 'Shopify & Store Tools', 100,
    '{"keywords": ["shopify", "domain", "hosting", "godaddy", "razorpay fee", "instamojo fee"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Stationery & Office", "payment_method": "Card"}'::jsonb),

  -- 4. Quick commerce grocery delivery
  (null, 'Quick Grocery Delivery', 100,
    '{"keywords": ["zepto", "blinkit", "instamart", "bigbasket", "bb now"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Grocery", "payment_method": "UPI"}'::jsonb),

  -- 5. Food delivery & takeaway
  (null, 'Food Delivery & Takeaway', 100,
    '{"keywords": ["zomato", "swiggy", "eatclub", "mcdonalds", "dominos", "pizza", "burger"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Dining & Takeaway", "subcategory_name": "Food Delivery", "payment_method": "UPI"}'::jsonb),

  -- 6. Fresh vegetables & fruits
  (null, 'Fresh Fruits & Vegetables', 100,
    '{"keywords": ["sabji", "vegetables", "bhaji", "tameta", "bataka", "fruit", "fruits", "kela", "apple", "mango", "grapes"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Vegetables & Fruits"}'::jsonb),

  -- 7. Electricity & Gas utility bills
  (null, 'Electricity & Gas Bills', 100,
    '{"keywords": ["torrent power", "light bill", "bijli bill", "adani gas", "gas bill", "cylinder", "lpg"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Housing & Utilities", "subcategory_name": "Electricity", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb),

  -- 8. Internet & mobile recharges
  (null, 'WiFi & Mobile Recharges', 100,
    '{"keywords": ["jio fiber", "airtel fiber", "wifi bill", "jio recharge", "airtel recharge", "mobile recharge"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Housing & Utilities", "subcategory_name": "Internet & Wi-Fi", "payment_method": "UPI"}'::jsonb),

  -- 9. OTT & Entertainment subscriptions
  (null, 'OTT & Subscriptions', 100,
    '{"keywords": ["netflix", "prime video", "hotstar", "spotify", "youtube premium", "icloud", "chatgpt"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Entertainment & Leisure", "subcategory_name": "OTT & Streaming", "payment_method": "Card"}'::jsonb),

  -- 10. Auto rickshaw & cab rides
  (null, 'Auto & Cab Rides', 100,
    '{"keywords": ["uber", "ola", "rapido", "auto rickshaw", "rickshaw", "cab fare"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Transport & Travel", "subcategory_name": "Auto / Taxi / Cab", "payment_method": "UPI"}'::jsonb)
on conflict do nothing;
