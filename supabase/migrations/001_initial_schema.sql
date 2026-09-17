-- GharKharch: initial schema
-- Money is always numeric(12,2), never floating point.

create extension if not exists pgcrypto;

-- =========================================================
-- Households & members
-- =========================================================

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Household',
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table households is 'A private household shared by exactly two people (husband/wife).';

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- =========================================================
-- Profiles & preferences
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_currency text not null default 'INR',
  default_payment_method text,
  default_expense_owner uuid references auth.users(id),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  start_of_week text not null default 'monday' check (start_of_week in ('monday', 'sunday')),
  dashboard_preferences jsonb not null default '{}'::jsonb,
  quick_add_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Categories (hierarchical, can be global defaults or household-owned)
-- =========================================================

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade, -- null = global default category
  parent_id uuid references categories(id) on delete cascade,
  name text not null,
  icon text not null default 'circle',
  color text not null default 'neutral',
  type text not null default 'expense' check (type in ('expense', 'income')),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Merchants (per-household, user-extensible)
-- =========================================================

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category_id uuid references categories(id) on delete set null,
  subcategory_id uuid references categories(id) on delete set null,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

-- =========================================================
-- Recurring expense rules (never auto-create transactions)
-- =========================================================

create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category_id uuid not null references categories(id),
  merchant_id uuid references merchants(id) on delete set null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
  next_due_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Expenses (the core table)
-- =========================================================

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  paid_by uuid not null references auth.users(id),
  expense_type text not null default 'household' check (expense_type in ('personal', 'household', 'shared')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  merchant_id uuid references merchants(id) on delete set null,
  item_name text not null,
  category_id uuid not null references categories(id),
  subcategory_id uuid references categories(id),
  payment_method text,
  expense_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  expense_time time,
  notes text,
  is_recurring boolean not null default false,
  recurring_rule_id uuid references recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column expenses.expense_date is 'The logical date the spend happened (backdatable), separate from created_at.';

-- =========================================================
-- Smart-learning data
-- =========================================================

create table if not exists expense_patterns (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  item_name text,
  category_id uuid not null references categories(id),
  subcategory_id uuid references categories(id),
  frequency_score numeric not null default 0,
  last_used_at timestamptz,
  usage_count int not null default 0,
  average_amount numeric(12,2),
  amount_min numeric(12,2),
  amount_max numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Budgets (architecture prepared now; UI can come later)
-- =========================================================

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade, -- null = overall household budget
  person_id uuid references auth.users(id) on delete cascade,   -- null = whole-household budget
  period_month date not null, -- always the 1st of the month
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, person_id, period_month)
);

-- =========================================================
-- updated_at trigger
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['households','profiles','user_preferences','merchants','recurring_expenses','expenses','expense_patterns','budgets']
  loop
    execute format('drop trigger if exists set_updated_at on %I;', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =========================================================
-- New-user bootstrap: profile + preferences row on signup
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Household membership helper (SECURITY DEFINER avoids RLS recursion)
-- =========================================================

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id
      and user_id = auth.uid()
  );
$$;

-- =========================================================
-- Create a household + seed defaults, atomically, as the owner
-- =========================================================

create or replace function public.create_household(p_name text default 'Our Household')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_cat record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'Our Household'))
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'owner');

  insert into user_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  -- seed a handful of well-known Indian merchants, mapped to global categories where possible
  for v_cat in
    select name, icon,
      case name
        when 'D-Mart' then 'Grocery'
        when 'Reliance Fresh' then 'Grocery'
        when 'Local Kirana' then 'Grocery'
        when 'Local Dairy' then 'Dairy'
        when 'Zudio' then 'Zudio'
        when 'Reliance Trends' then 'Clothing'
        when 'Myntra' then 'Online Shopping'
        when 'Croma' then 'Croma'
        when 'Reliance Digital' then 'Electronics'
        when 'Vijay Sales' then 'Electronics'
        when 'Amazon' then 'Online Shopping'
        when 'Flipkart' then 'Online Shopping'
        when 'Swiggy' then 'Dining Out'
        when 'Zomato' then 'Dining Out'
        when 'Uber' then 'Cab'
        when 'Ola' then 'Cab'
      end as subcat_name
    from (values
      ('D-Mart'), ('Reliance Fresh'), ('Local Kirana'), ('Local Dairy'),
      ('Zudio'), ('Reliance Trends'), ('Myntra'),
      ('Croma'), ('Reliance Digital'), ('Vijay Sales'),
      ('Amazon'), ('Flipkart'), ('Swiggy'), ('Zomato'), ('Uber'), ('Ola')
    ) as m(name), lateral (select null::text as icon) i
  loop
    insert into merchants (household_id, name, normalized_name, subcategory_id)
    select
      v_household_id,
      v_cat.name,
      lower(regexp_replace(v_cat.name, '[^a-zA-Z0-9]+', '', 'g')),
      c.id
    from categories c
    where c.household_id is null and c.name = v_cat.subcat_name
    limit 1
    on conflict (household_id, normalized_name) do nothing;
  end loop;

  return v_household_id;
end;
$$;

-- =========================================================
-- Join an existing household via its invite code
-- =========================================================

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_household_id from households where invite_code = lower(trim(p_code));

  if v_household_id is null then
    raise exception 'Invalid invite code';
  end if;

  if exists (select 1 from household_members where household_id = v_household_id and user_id = auth.uid()) then
    return v_household_id;
  end if;

  select count(*) into v_member_count from household_members where household_id = v_household_id;
  if v_member_count >= 2 then
    raise exception 'This household already has two members';
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'member');

  insert into user_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return v_household_id;
end;
$$;
