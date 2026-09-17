-- =========================================================
-- Migration 014 - let a household "customize" a global default
-- =========================================================
-- Categories and merchants with household_id = null are global/system data,
-- shared and visible to every household - that's why every update/delete
-- action in this app refuses to touch them directly (see e.g.
-- update_category/update_merchant's household_id checks, and 011's merge
-- functions). That's still correct: one household editing "Milk" in place
-- would silently rename it for every other household in the database too.
--
-- But the person should still be able to rename, re-icon, re-color, reorder,
-- or remove a default *for their own household* without touching the shared
-- row. The pattern: hide the global row for that household (it stops
-- appearing in their lists/pickers, but nothing about the shared row itself
-- changes, and no other household is affected) and, if they asked to edit
-- rather than just remove it, create a normal household-owned category/
-- merchant seeded from the default's values, which is then a completely
-- ordinary editable row like any the household created themselves.
--
-- Two small per-household "hide" tables are enough for this - no changes to
-- categories/merchants themselves, and no risk to shared data.

create table if not exists household_hidden_categories (
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (household_id, category_id)
);

create table if not exists household_hidden_merchants (
  household_id uuid not null references households(id) on delete cascade,
  merchant_id uuid not null references merchants(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (household_id, merchant_id)
);

comment on table household_hidden_categories is 'Per-household suppression of a global/default category (spec: "customize a default" without mutating shared data). A row here means this household no longer sees that category in lists/pickers - the category row itself, and every other household''s view of it, is untouched.';
comment on table household_hidden_merchants is 'Per-household suppression of a global/system merchant, mirroring household_hidden_categories.';

alter table household_hidden_categories enable row level security;
alter table household_hidden_merchants enable row level security;

create policy "Members can view their household's hidden categories"
  on household_hidden_categories for select
  using (public.is_household_member(household_id));

create policy "Members can hide a global category for their household"
  on household_hidden_categories for insert
  with check (
    public.is_household_member(household_id)
    and exists (select 1 from categories where id = category_id and household_id is null)
  );

create policy "Members can unhide a category for their household"
  on household_hidden_categories for delete
  using (public.is_household_member(household_id));

create policy "Members can view their household's hidden merchants"
  on household_hidden_merchants for select
  using (public.is_household_member(household_id));

create policy "Members can hide a global merchant for their household"
  on household_hidden_merchants for insert
  with check (
    public.is_household_member(household_id)
    and exists (select 1 from merchants where id = merchant_id and household_id is null)
  );

create policy "Members can unhide a merchant for their household"
  on household_hidden_merchants for delete
  using (public.is_household_member(household_id));

-- =========================================================
-- customize_category / customize_merchant - the "Edit" path for a default
-- =========================================================
-- Creates a household-owned copy seeded from the global row's current
-- values (or the caller's edits, if provided), hides the global original for
-- this household, and returns the new row. Everything after this is just an
-- ordinary household category/merchant - full edit/delete/reorder applies.

create or replace function public.customize_category(
  p_global_id uuid,
  p_household_id uuid,
  p_name text default null,
  p_icon text default null,
  p_color text default null
)
returns categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global categories;
  v_new categories;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not authorized for this household';
  end if;

  select * into v_global from categories where id = p_global_id and household_id is null;
  if not found then
    raise exception 'That category is not a global default';
  end if;

  insert into categories (household_id, name, parent_id, icon, color, sort_order, is_active)
  values (
    p_household_id,
    coalesce(p_name, v_global.name),
    v_global.parent_id,
    coalesce(p_icon, v_global.icon),
    coalesce(p_color, v_global.color),
    v_global.sort_order,
    true
  )
  returning * into v_new;

  insert into household_hidden_categories (household_id, category_id)
  values (p_household_id, p_global_id)
  on conflict do nothing;

  return v_new;
end;
$$;

create or replace function public.customize_merchant(
  p_global_id uuid,
  p_household_id uuid,
  p_name text default null,
  p_icon text default null
)
returns merchants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global merchants;
  v_new merchants;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not authorized for this household';
  end if;

  select * into v_global from merchants where id = p_global_id and household_id is null;
  if not found then
    raise exception 'That merchant is not global/system';
  end if;

  insert into merchants (household_id, name, normalized_name, category_id, subcategory_id, merchant_type, channel, icon, is_active)
  values (
    p_household_id,
    coalesce(p_name, v_global.name),
    lower(trim(coalesce(p_name, v_global.name))),
    v_global.category_id,
    v_global.subcategory_id,
    v_global.merchant_type,
    v_global.channel,
    coalesce(p_icon, v_global.icon),
    true
  )
  returning * into v_new;

  insert into household_hidden_merchants (household_id, merchant_id)
  values (p_household_id, p_global_id)
  on conflict do nothing;

  return v_new;
end;
$$;

comment on function public.customize_category(uuid, uuid, text, text, text) is 'Turns a global default category into a household-owned, fully editable one: creates the household copy (with any provided name/icon/color overrides) and hides the shared original for that household only.';
comment on function public.customize_merchant(uuid, uuid, text, text) is 'Turns a global/system merchant into a household-owned, fully editable one, mirroring customize_category.';

-- =========================================================
-- Hide-only (the "Remove"/"delete" path for a default the household
-- doesn't want, without creating a replacement)
-- =========================================================

create or replace function public.hide_global_category(p_category_id uuid, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not authorized for this household';
  end if;
  if not exists (select 1 from categories where id = p_category_id and household_id is null) then
    raise exception 'That category is not a global default';
  end if;
  insert into household_hidden_categories (household_id, category_id)
  values (p_household_id, p_category_id)
  on conflict do nothing;
end;
$$;

create or replace function public.hide_global_merchant(p_merchant_id uuid, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not authorized for this household';
  end if;
  if not exists (select 1 from merchants where id = p_merchant_id and household_id is null) then
    raise exception 'That merchant is not global/system';
  end if;
  insert into household_hidden_merchants (household_id, merchant_id)
  values (p_household_id, p_merchant_id)
  on conflict do nothing;
end;
$$;

comment on function public.hide_global_category(uuid, uuid) is 'Removes a global default category from one household''s view (pickers/lists) without touching the shared row or any other household. Past expenses already using it keep their category.';
comment on function public.hide_global_merchant(uuid, uuid) is 'Removes a global/system merchant from one household''s view, mirroring hide_global_category.';
