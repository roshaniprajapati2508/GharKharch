-- GharKharch: Indian commerce, payment & bill ecosystem
-- (extends the schema per the "GharKharch - Indian Commerce, Payment & Bill
-- Ecosystem" addendum). Purely additive/altering — never drops user data.
--
-- Summary of what this migration does:
--   1. Upgrades `merchants` from household-only to a global-catalogue-or-household
--      pattern identical to `categories` (system merchants with household_id null,
--      plus per-household custom merchants), and adds merchant_type/channel/
--      aliases/parent_merchant_id/is_system/logo_url.
--   2. Adds the card catalogue: card_issuers, card_products, user_cards.
--   3. Adds bank_accounts and upi_profiles (identifiers only — never credentials).
--   4. Adds the bills module: bill_providers, bills.
--   5. Adds optional payment-instrument links on `expenses` (card_id /
--      upi_profile_id / bank_account_id), at most one set at a time.
--   6. Adds an "Advertising & Marketing" subcategory + a system "Meta Ads"
--      merchant (spec addendum note on tracking ad spend).

-- =========================================================
-- 1. Merchants: household-only -> global-catalogue-or-household
-- =========================================================

alter table merchants alter column household_id drop not null;
alter table merchants add column if not exists merchant_type text not null default 'other'
  check (merchant_type in (
    'delivery','grocery','food','shopping','fashion','electronics','entertainment',
    'movies','travel','fuel','pharmacy','utility','local_store','restaurant',
    'marketplace','subscription','advertising','other'
  ));
alter table merchants add column if not exists parent_merchant_id uuid references merchants(id) on delete set null;
alter table merchants add column if not exists channel text not null default 'offline'
  check (channel in ('online', 'offline', 'mixed'));
alter table merchants add column if not exists aliases text[] not null default '{}';
alter table merchants add column if not exists is_system boolean not null default false;
alter table merchants add column if not exists logo_url text;

comment on column merchants.household_id is 'Null = system/global merchant catalogue entry, visible to every household but not editable by them. Set = a household''s own custom merchant.';
comment on column merchants.aliases is 'Alternate spellings/short names that should resolve to this merchant during quick-entry matching, e.g. {"insta","swiggy instamart"} -> Swiggy Instamart.';

-- The existing unique(household_id, normalized_name) constraint from 001 still
-- works for household-owned rows (Postgres treats NULL as distinct per-row, so
-- it does NOT prevent duplicate global rows) — add an explicit partial unique
-- index so system merchant names stay unique among themselves.
create unique index if not exists idx_merchants_global_unique
  on merchants (normalized_name) where household_id is null;

create index if not exists idx_merchants_type on merchants (merchant_type);
create index if not exists idx_merchants_parent on merchants (parent_merchant_id);
create index if not exists idx_merchants_aliases on merchants using gin (aliases);

-- RLS: merchants now need the same "global read, household-scoped write" shape
-- as categories. Replace the single blanket policy from 002.
drop policy if exists "merchants: household access" on merchants;

create policy "merchants: view global or own household" on merchants
  for select using (household_id is null or public.is_household_member(household_id));

create policy "merchants: insert own household merchants" on merchants
  for insert with check (household_id is not null and public.is_household_member(household_id));

create policy "merchants: update own household merchants" on merchants
  for update using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "merchants: delete own household merchants" on merchants
  for delete using (household_id is not null and public.is_household_member(household_id));

-- =========================================================
-- 2. Card catalogue: issuers, products (extensible, never a hard-coded list),
--    and the user's own cards.
-- =========================================================

create table if not exists card_issuers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists card_products (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references card_issuers(id) on delete cascade,
  name text not null,
  variant text,
  network text check (network in ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'other')),
  card_type text not null default 'credit' check (card_type in ('credit', 'debit', 'prepaid')),
  default_credit_limit numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (issuer_id, name, variant)
);

-- Never store: full card number, CVV, PIN, UPI PIN, netbanking password, OTP.
-- Only what's needed for identification: issuer, product/variant, network, last4.
create table if not exists user_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  issuer_id uuid references card_issuers(id) on delete set null,
  card_product_id uuid references card_products(id) on delete set null,
  custom_name text not null, -- e.g. "HDFC Regalia" — always shown, even if issuer/product are unset
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  network text check (network in ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'other')),
  card_type text not null default 'credit' check (card_type in ('credit', 'debit', 'prepaid')),
  credit_limit numeric(12,2),
  statement_day int check (statement_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table user_cards is 'Identification-only card records for spend tracking. Never stores card numbers, CVV, PIN, or any credential.';

do $$
begin
  execute 'drop trigger if exists set_updated_at on user_cards';
  execute 'create trigger set_updated_at before update on user_cards for each row execute function public.set_updated_at()';
end $$;

alter table card_issuers enable row level security;
alter table card_products enable row level security;
alter table user_cards enable row level security;

create policy "card_issuers: readable by any authenticated user" on card_issuers
  for select using (auth.uid() is not null);

create policy "card_products: readable by any authenticated user" on card_products
  for select using (auth.uid() is not null);

create policy "user_cards: household access" on user_cards
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create index if not exists idx_user_cards_household on user_cards (household_id, is_active);
create index if not exists idx_card_products_issuer on card_products (issuer_id);

-- =========================================================
-- 3. Bank accounts & UPI profiles — identifiers only, never credentials.
-- =========================================================

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null,
  account_type text not null default 'savings' check (account_type in ('savings', 'current', 'other')),
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{2,4}$'),
  nickname text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table bank_accounts is 'Identifier-only (last 2-4 digits) bank account registry for spend tracking. Never stores full account numbers or credentials.';

create table if not exists upi_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, -- e.g. "Google Pay" or "PhonePe - HDFC"
  upi_app text not null default 'other' check (upi_app in ('google_pay', 'phonepe', 'paytm', 'bhim', 'bank_upi', 'other')),
  linked_bank_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table upi_profiles is 'UPI payment profile labels only — never stores UPI PIN or any credential.';

do $$
declare t text;
begin
  foreach t in array array['bank_accounts', 'upi_profiles']
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table bank_accounts enable row level security;
alter table upi_profiles enable row level security;

create policy "bank_accounts: household access" on bank_accounts
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "upi_profiles: household access" on upi_profiles
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create index if not exists idx_bank_accounts_household on bank_accounts (household_id, is_active);
create index if not exists idx_upi_profiles_household on upi_profiles (household_id, is_active);

-- =========================================================
-- 4. Bills module
-- =========================================================

create table if not exists bill_providers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade, -- null = system provider
  name text not null,
  provider_type text not null check (provider_type in ('electricity', 'gas', 'water', 'internet', 'mobile', 'dth', 'maintenance', 'other')),
  state text, -- e.g. 'Gujarat' — informational only, not used to filter
  logo_url text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_bill_providers_global_unique
  on bill_providers (name, provider_type) where household_id is null;

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  provider_id uuid references bill_providers(id) on delete set null,
  bill_type text not null check (bill_type in ('electricity', 'gas', 'water', 'internet', 'mobile', 'dth', 'maintenance', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  billing_period_start date,
  billing_period_end date,
  due_date date,
  paid_date date,
  payment_method text, -- mirrors expenses.payment_method (free text label)
  card_id uuid references user_cards(id) on delete set null,
  status text not null default 'upcoming' check (status in ('upcoming', 'due', 'paid', 'overdue', 'cancelled')),
  is_recurring boolean not null default false,
  recurring_frequency text check (recurring_frequency is null or recurring_frequency in ('monthly', 'quarterly', 'yearly', 'irregular')),
  linked_expense_id uuid references expenses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column bills.linked_expense_id is 'Set when "mark as paid" creates the corresponding row in expenses, so bill totals and expense totals never double count by accident when reported together.';

do $$
begin
  execute 'drop trigger if exists set_updated_at on bills';
  execute 'create trigger set_updated_at before update on bills for each row execute function public.set_updated_at()';
end $$;

alter table bill_providers enable row level security;
alter table bills enable row level security;

create policy "bill_providers: view global or own household" on bill_providers
  for select using (household_id is null or public.is_household_member(household_id));

create policy "bill_providers: manage own household providers" on bill_providers
  for insert with check (household_id is not null and public.is_household_member(household_id));

create policy "bill_providers: update own household providers" on bill_providers
  for update using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "bill_providers: delete own household providers" on bill_providers
  for delete using (household_id is not null and public.is_household_member(household_id));

create policy "bills: household access" on bills
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create index if not exists idx_bills_household on bills (household_id, status);
create index if not exists idx_bills_household_due on bills (household_id, due_date);
create index if not exists idx_bill_providers_type on bill_providers (provider_type);

-- =========================================================
-- 5. Optional payment-instrument links on expenses
-- =========================================================

alter table expenses add column if not exists card_id uuid references user_cards(id) on delete set null;
alter table expenses add column if not exists upi_profile_id uuid references upi_profiles(id) on delete set null;
alter table expenses add column if not exists bank_account_id uuid references bank_accounts(id) on delete set null;

alter table expenses drop constraint if exists expenses_one_payment_instrument_chk;
alter table expenses add constraint expenses_one_payment_instrument_chk check (
  (case when card_id is not null then 1 else 0 end
   + case when upi_profile_id is not null then 1 else 0 end
   + case when bank_account_id is not null then 1 else 0 end) <= 1
);

create index if not exists idx_expenses_card on expenses (card_id) where card_id is not null;
create index if not exists idx_expenses_upi_profile on expenses (upi_profile_id) where upi_profile_id is not null;
create index if not exists idx_expenses_bank_account on expenses (bank_account_id) where bank_account_id is not null;

-- =========================================================
-- 6. Advertising/marketing spend tracking (spec addendum note 8.1)
-- =========================================================

insert into categories (household_id, parent_id, name, icon, color, sort_order)
select null, p.id, 'Advertising & Marketing', 'megaphone', 'teal', 5
from categories p
where p.name = 'Personal' and p.household_id is null and p.parent_id is null
on conflict do nothing;

insert into merchants (household_id, name, normalized_name, merchant_type, channel, is_system, subcategory_id, aliases)
select null, 'Meta Ads', 'metaads', 'advertising', 'online', true, c.id, array['facebook ads', 'instagram ads', 'fb ads']
from categories c
join categories p on p.id = c.parent_id
where c.name = 'Advertising & Marketing' and p.name = 'Personal' and p.household_id is null
on conflict (normalized_name) where household_id is null do nothing;
