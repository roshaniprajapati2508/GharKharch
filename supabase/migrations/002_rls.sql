-- GharKharch: Row Level Security
-- Every household-scoped table is locked to members of that household only.
-- household_members has NO client-facing insert/update/delete policy on purpose:
-- membership changes only happen through the create_household / join_household_by_code
-- SECURITY DEFINER functions, which bypass RLS deliberately and safely.

alter table households enable row level security;
alter table household_members enable row level security;
alter table profiles enable row level security;
alter table user_preferences enable row level security;
alter table categories enable row level security;
alter table merchants enable row level security;
alter table recurring_expenses enable row level security;
alter table expenses enable row level security;
alter table expense_patterns enable row level security;
alter table budgets enable row level security;

-- ---------------------------------------------------------
-- households
-- ---------------------------------------------------------
create policy "households: members can view" on households
  for select using (public.is_household_member(id));

create policy "households: owner can update" on households
  for update using (
    exists (select 1 from household_members where household_id = id and user_id = auth.uid() and role = 'owner')
  ) with check (
    exists (select 1 from household_members where household_id = id and user_id = auth.uid() and role = 'owner')
  );

-- No direct insert/delete policy: households are created via create_household().

-- ---------------------------------------------------------
-- household_members
-- ---------------------------------------------------------
create policy "household_members: members can view roster" on household_members
  for select using (public.is_household_member(household_id));

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
create policy "profiles: self and household partner can view" on profiles
  for select using (
    id = auth.uid()
    or id in (
      select hm2.user_id from household_members hm1
      join household_members hm2 on hm2.household_id = hm1.household_id
      where hm1.user_id = auth.uid()
    )
  );

create policy "profiles: self can update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: self can insert" on profiles
  for insert with check (id = auth.uid());

-- ---------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------
create policy "user_preferences: self only" on user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- categories (global defaults are readable by everyone; household ones are scoped)
-- ---------------------------------------------------------
create policy "categories: view global or own household" on categories
  for select using (household_id is null or public.is_household_member(household_id));

create policy "categories: manage own household categories" on categories
  for insert with check (household_id is not null and public.is_household_member(household_id));

create policy "categories: update own household categories" on categories
  for update using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "categories: delete own household categories" on categories
  for delete using (household_id is not null and public.is_household_member(household_id));

-- ---------------------------------------------------------
-- merchants
-- ---------------------------------------------------------
create policy "merchants: household access" on merchants
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------
-- recurring_expenses
-- ---------------------------------------------------------
create policy "recurring_expenses: household access" on recurring_expenses
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------
-- expenses
-- ---------------------------------------------------------
create policy "expenses: household access" on expenses
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------
-- expense_patterns
-- ---------------------------------------------------------
create policy "expense_patterns: household access" on expense_patterns
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------
-- budgets
-- ---------------------------------------------------------
create policy "budgets: household access" on budgets
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
