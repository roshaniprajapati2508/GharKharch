-- GharKharch: IFTTT-style Smart Rules Engine (spec: Module 1 / Developer
-- Implementation Brief). A dedicated `automation_rules` table so typing (or
-- speaking) something like "yogesh xerox 450" in the Add Expense/Income
-- sheet can auto-fill category, merchant, paid-by/received-by and payment
-- method by matching keywords against a household's own rules.
--
-- Deviation from the pasted schema, documented here on purpose: the pasted
-- `actions` jsonb shape used raw `category_id` / `merchant_id` UUID
-- columns. Those ids don't exist yet at migration-seed-time (they're
-- generated per-environment/per-household, exactly like every other seed
-- in this project), so this migration seeds `actions` by NAME instead
-- (`category_name`, `subcategory_name`, `merchant_name`, `paid_by_name`) -
-- the same "match by name, resolve to id at runtime" convention already
-- used by migrations 020, 021, 022, 023. The application's rule-matching
-- engine resolves these names against the household's already-loaded
-- category tree / merchant list / member list when a rule fires, and
-- writes the resolved real ids onto the expense being created - the
-- `automation_rules` row itself never stores a UUID that could go stale
-- or point at the wrong household's copy of a global category.
--
-- household_id is nullable so a set of sensible global defaults (seeded
-- below) ships to every household, exactly like global categories/
-- merchants/payment methods elsewhere in this schema - any household can
-- still deactivate a global rule (is_active) or add its own household-only
-- rules alongside them.

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  priority int not null default 0,
  is_active boolean not null default true,

  -- Triggers (JSONB). keywords are matched case-insensitively as
  -- substrings against the raw item-name / voice-input text. min_amount /
  -- max_amount / entry_type / time_of_day are optional extra narrowing
  -- conditions a user can add via the /more/rules builder; null means
  -- "don't filter on this".
  conditions jsonb not null default '{
    "keywords": [],
    "min_amount": null,
    "max_amount": null,
    "entry_type": null,
    "time_of_day": null
  }'::jsonb,

  -- Auto-applied actions (JSONB). Name-based (see note above) rather than
  -- raw ids: category_name / subcategory_name / merchant_name /
  -- paid_by_name are resolved to real ids at runtime by the rule-matching
  -- engine. entry_type, when set, switches the sheet to Income mode.
  actions jsonb not null default '{
    "category_name": null,
    "subcategory_name": null,
    "merchant_name": null,
    "payment_method": null,
    "paid_by_name": null,
    "entry_type": null
  }'::jsonb,

  execution_count int not null default 0,
  last_executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_household on automation_rules(household_id);
create index if not exists idx_automation_rules_active on automation_rules(household_id, is_active) where is_active;

alter table automation_rules enable row level security;

create policy "automation_rules_select" on automation_rules
  for select using (
    household_id is null or public.is_household_member(household_id)
  );

create policy "automation_rules_insert" on automation_rules
  for insert with check (public.is_household_member(household_id));

create policy "automation_rules_update" on automation_rules
  for update using (public.is_household_member(household_id));

create policy "automation_rules_delete" on automation_rules
  for delete using (public.is_household_member(household_id));

comment on table automation_rules is
  'IFTTT-style smart rules (migration 024) - keyword-triggered auto-fill of category/merchant/paid-by/payment-method in the Add Expense/Income sheet. Seeded rows below are global defaults (household_id null); households can deactivate them (via household_hidden_automation_rules, mirroring household_hidden_categories/_merchants from migration 014) or add their own.';

-- Per-household suppression of a global default rule, exactly mirroring
-- household_hidden_categories / household_hidden_merchants (migration
-- 014) - turning a global rule "off" for one household must never mutate
-- the shared global row (that would turn it off for every household), so
-- it's recorded as a hide here instead. listAutomationRules() /
-- the matching engine both filter global rules through this table.
create table if not exists household_hidden_automation_rules (
  household_id uuid not null references households(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (household_id, rule_id)
);

alter table household_hidden_automation_rules enable row level security;

create policy "household_hidden_automation_rules_select" on household_hidden_automation_rules
  for select using (public.is_household_member(household_id));

create policy "household_hidden_automation_rules_insert" on household_hidden_automation_rules
  for insert with check (
    public.is_household_member(household_id)
    and exists (select 1 from automation_rules where id = rule_id and household_id is null)
  );

create policy "household_hidden_automation_rules_delete" on household_hidden_automation_rules
  for delete using (public.is_household_member(household_id));

comment on table household_hidden_automation_rules is
  'Per-household suppression of a global default automation rule, mirroring household_hidden_categories/_merchants (migration 014).';

-- Seeded global default rules, per the Developer Implementation Brief.
-- Every keyword list is matched case-insensitively as a substring of the
-- typed/spoken item text. Categories/merchants referenced here (Printing &
-- Xerox, Courier & Shipping, Raw Materials, Groceries, Snacks & Street
-- Food, Fuel, Business Sales & Payouts, Salary, Freelancing & Consulting)
-- must already exist as category/merchant names for the resolving engine
-- to find a match - if a household doesn't have one of these categories,
-- that single field simply won't get auto-filled, the rest of the rule's
-- actions still apply.
insert into automation_rules (household_id, name, priority, conditions, actions)
values
  -- A. LuxeKraft & Homemade Business expenses
  (null, 'Xerox & Book Stock', 100,
    '{"keywords": ["xerox", "zerox", "print", "binding", "satyam", "yogesh"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Printing & Xerox", "merchant_name": "Satyam Xerox", "payment_method": "UPI"}'::jsonb),

  (null, 'Courier & Logistics', 100,
    '{"keywords": ["courier", "shiprocket", "parcel", "speed post", "mahavir", "nandan", "maruti", "porter"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Courier & Shipping", "merchant_name": "Shiprocket", "payment_method": "UPI"}'::jsonb),

  (null, 'Raw Materials & Stock', 100,
    '{"keywords": ["henna", "cone", "nilgiri", "makhana", "bubble wrap", "tape", "box", "packaging"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Homemade Business", "subcategory_name": "Raw Materials", "paid_by_name": "Roshni"}'::jsonb),

  -- B. Business & personal incomes
  (null, 'Amazon Seller Payout', 100,
    '{"keywords": ["amazon seller", "amazon payout", "amzn payout", "amazon books", "amzn seller"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Business Sales & Payouts", "merchant_name": "Amazon Seller Payout", "paid_by_name": "Roshni"}'::jsonb),

  (null, 'Meesho / Flipkart Payout', 100,
    '{"keywords": ["meesho", "flipkart", "fipkart", "flipkart seller", "meesho seller", "seller payout", "seller payout books", "books payout", "book payout", "website orders", "website order"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Business Sales & Payouts", "merchant_name": "Flipkart Seller Payout", "paid_by_name": "Roshni"}'::jsonb),

  (null, 'Mehndi Client Order', 100,
    '{"keywords": ["mehndi order", "bridal mehndi", "henna client", "mehndi client"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Business Sales & Payouts", "paid_by_name": "Roshni"}'::jsonb),

  (null, 'Harsh Salary Deposit', 100,
    '{"keywords": ["salary", "payroll", "monthly salary", "salary credit"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Salary", "paid_by_name": "Harsh", "payment_method": "Bank Transfer"}'::jsonb),

  (null, 'Freelancing Payment', 100,
    '{"keywords": ["freelance", "consulting", "web dev", "client payment", "project payout"], "entry_type": null}'::jsonb,
    '{"entry_type": "income", "category_name": "Freelancing & Consulting", "paid_by_name": "Harsh"}'::jsonb),

  -- C. Household & daily local food
  (null, 'Daily Dairy & Milk', 100,
    '{"keywords": ["doodh", "milk", "chhas", "dahi", "amul"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Dairy", "payment_method": "UPI"}'::jsonb),

  (null, 'Khiru & Fresh Batter', 100,
    '{"keywords": ["khiru", "dhokla", "idli batter", "dosa khiru"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Grocery", "payment_method": "UPI"}'::jsonb),

  (null, 'Farsan & Nasto', 100,
    '{"keywords": ["pav", "bread", "nasto", "farsan", "khaman", "samosa"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Food & Grocery", "subcategory_name": "Nasto & Farsan", "payment_method": "UPI"}'::jsonb),

  (null, 'Vehicle Fuel', 100,
    '{"keywords": ["petrol", "diesel", "cng", "fuel", "hp", "ioc"], "entry_type": "expense"}'::jsonb,
    '{"category_name": "Transport", "subcategory_name": "Petrol", "paid_by_name": "Harsh", "payment_method": "UPI"}'::jsonb)
on conflict do nothing;
