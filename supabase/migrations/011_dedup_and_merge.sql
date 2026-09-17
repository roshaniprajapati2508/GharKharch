-- GharKharch: Premium UX phase — category/merchant duplicate cleanup + safe
-- merge functions (spec items 4, 37-46, 79-80).
--
-- ROOT CAUSE of the duplicate "Milk / Milk", "Curd / Curd" global categories
-- you're seeing: every subcategory `insert` in 004_seed_categories.sql has no
-- `on conflict` guard (only the top-level category insert does). If 004 ever
-- ran more than once against the same database, every subcategory doubled.
-- This migration is a one-time, idempotent cleanup of that specific damage,
-- plus a scoped unique index so it can never silently happen again, plus two
-- SECURITY DEFINER functions so end users can safely merge their *own*
-- household-created duplicates (e.g. "Zudio" / "Zudio Store") from the UI.
--
-- Safe to run more than once: every step below is guarded (idempotent dedup
-- loop, `create ... if not exists`, `create or replace function`).

-- =========================================================
-- Part A — one-time cleanup of the accidental global category duplicates
-- =========================================================
-- Global categories only (household_id is null) — household-created
-- duplicates are left alone here; those are merged interactively via
-- merge_categories() below, since deleting a household's own data without
-- their say-so would be wrong.

-- Runs as a repeat-until-clean loop rather than a single pass: merging two
-- duplicate PARENT categories (e.g. two "Electronics" rows) reparents their
-- children onto the same canonical parent, which can itself newly create a
-- child-level duplicate (two "Croma" rows now sharing one parent) that a
-- single pass would never revisit. Bounded to 20 passes as a safety valve —
-- real duplication depth here is at most 2 levels (top-level + subcategory).

do $$
declare
  grp record;
  dup record;
  canonical_id uuid;
  pass_count int := 0;
  found_any boolean;
begin
  loop
    pass_count := pass_count + 1;
    found_any := false;

    for grp in
      select
        coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) as parent_key,
        lower(trim(name)) as name_key
      from categories
      where household_id is null
      group by 1, 2
      having count(*) > 1
    loop
      found_any := true;

      -- canonical = oldest row (min created_at, then min id as a stable tiebreak)
      select id into canonical_id
      from categories
      where household_id is null
        and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = grp.parent_key
        and lower(trim(name)) = grp.name_key
      order by created_at asc, id asc
      limit 1;

      for dup in
        select id
        from categories
        where household_id is null
          and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = grp.parent_key
          and lower(trim(name)) = grp.name_key
          and id <> canonical_id
      loop
        update categories set parent_id = canonical_id where parent_id = dup.id;
        update merchants set category_id = canonical_id where category_id = dup.id;
        update merchants set subcategory_id = canonical_id where subcategory_id = dup.id;
        update recurring_expenses set category_id = canonical_id where category_id = dup.id;
        update budgets set category_id = canonical_id where category_id = dup.id;
        update expenses set category_id = canonical_id where category_id = dup.id;
        update expenses set subcategory_id = canonical_id where subcategory_id = dup.id;
        update expense_patterns set category_id = canonical_id where category_id = dup.id;
        update expense_patterns set subcategory_id = canonical_id where subcategory_id = dup.id;

        delete from categories where id = dup.id;
      end loop;
    end loop;

    exit when not found_any or pass_count >= 20;
  end loop;
end $$;

-- =========================================================
-- Part B — same cleanup for global merchants, defensively
-- =========================================================
-- 009's seed already guards against this with `on conflict ... do nothing`,
-- so this loop should normally be a no-op — it's here only in case an older
-- run of 009 predates that guard.

do $$
declare
  grp record;
  dup record;
  canonical_id uuid;
  pass_count int := 0;
  found_any boolean;
begin
  loop
    pass_count := pass_count + 1;
    found_any := false;

    for grp in
      select normalized_name
      from merchants
      where household_id is null
      group by 1
      having count(*) > 1
    loop
      found_any := true;

      select id into canonical_id
      from merchants
      where household_id is null and normalized_name = grp.normalized_name
      order by created_at asc, id asc
      limit 1;

      for dup in
        select id from merchants
        where household_id is null and normalized_name = grp.normalized_name and id <> canonical_id
      loop
        update merchants set parent_merchant_id = canonical_id where parent_merchant_id = dup.id;
        update recurring_expenses set merchant_id = canonical_id where merchant_id = dup.id;
        update expenses set merchant_id = canonical_id where merchant_id = dup.id;
        update expense_patterns set merchant_id = canonical_id where merchant_id = dup.id;

        delete from merchants where id = dup.id;
      end loop;
    end loop;

    exit when not found_any or pass_count >= 20;
  end loop;
end $$;

-- =========================================================
-- Part C — prevent this class of bug from recurring
-- =========================================================
-- household_id and parent_id are both coalesced to a fixed sentinel so that
-- multiple NULLs (global scope / top-level category) are compared as equal,
-- which a plain multi-column unique index would not do (Postgres treats NULL
-- as distinct from NULL). Scoped to is_active so a deactivated duplicate
-- doesn't block recreating the same name.

create unique index if not exists idx_categories_unique_scope
  on categories (
    coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(name))
  )
  where is_active;

-- =========================================================
-- Part D — read-only merge-impact preview (spec item 39: "Affected expenses: 42")
-- =========================================================
-- security invoker + `stable`: relies on the caller's own RLS, same pattern
-- as the migration 006 analytics functions — never bypasses row security.

create or replace function public.get_category_merge_impact(p_duplicate_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'expense_count', (
      select count(*) from expenses
      where (category_id = p_duplicate_id or subcategory_id = p_duplicate_id) and deleted_at is null
    ),
    'merchant_count', (select count(*) from merchants where category_id = p_duplicate_id or subcategory_id = p_duplicate_id),
    'child_category_count', (select count(*) from categories where parent_id = p_duplicate_id)
  );
$$;

create or replace function public.get_merchant_merge_impact(p_duplicate_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'expense_count', (select count(*) from expenses where merchant_id = p_duplicate_id and deleted_at is null),
    'child_merchant_count', (select count(*) from merchants where parent_merchant_id = p_duplicate_id)
  );
$$;

-- =========================================================
-- Part E — safe interactive merge functions (spec items 39, 45, 79)
-- =========================================================
-- Both are SECURITY DEFINER (need to touch rows across tables regardless of
-- the caller's own RLS visibility into every dependent table) but both
-- independently re-check authorization before doing anything: the duplicate
-- being merged away must belong to the caller's own household — a global/
-- system category or merchant can never be the one deleted here, only ever
-- the *canonical* side of a merge. This matches spec item 81's "do not allow
-- dangerous edits to global records."

create or replace function public.merge_categories(p_canonical_id uuid, p_duplicate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dup_household_id uuid;
  v_canonical_household_id uuid;
  v_expense_count int;
begin
  if p_canonical_id = p_duplicate_id then
    raise exception 'Cannot merge a category with itself';
  end if;

  select household_id into v_dup_household_id from categories where id = p_duplicate_id;
  if v_dup_household_id is null then
    raise exception 'Global default categories cannot be merged away';
  end if;
  if not public.is_household_member(v_dup_household_id) then
    raise exception 'Not authorized to merge this category';
  end if;

  select household_id into v_canonical_household_id from categories where id = p_canonical_id;
  if v_canonical_household_id is not null and v_canonical_household_id <> v_dup_household_id then
    raise exception 'Categories must belong to the same household (the canonical side may be a global default)';
  end if;

  select count(*) into v_expense_count from expenses
    where (category_id = p_duplicate_id or subcategory_id = p_duplicate_id) and deleted_at is null;

  update categories set parent_id = p_canonical_id where parent_id = p_duplicate_id;
  update merchants set category_id = p_canonical_id where category_id = p_duplicate_id;
  update merchants set subcategory_id = p_canonical_id where subcategory_id = p_duplicate_id;
  update recurring_expenses set category_id = p_canonical_id where category_id = p_duplicate_id;
  update budgets set category_id = p_canonical_id where category_id = p_duplicate_id;
  update expenses set category_id = p_canonical_id where category_id = p_duplicate_id;
  update expenses set subcategory_id = p_canonical_id where subcategory_id = p_duplicate_id;
  update expense_patterns set category_id = p_canonical_id where category_id = p_duplicate_id;
  update expense_patterns set subcategory_id = p_canonical_id where subcategory_id = p_duplicate_id;

  delete from categories where id = p_duplicate_id;

  return jsonb_build_object('canonical_id', p_canonical_id, 'duplicate_id', p_duplicate_id, 'expenses_reassigned', v_expense_count);
end;
$$;

create or replace function public.merge_merchants(p_canonical_id uuid, p_duplicate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dup_household_id uuid;
  v_canonical_household_id uuid;
  v_expense_count int;
begin
  if p_canonical_id = p_duplicate_id then
    raise exception 'Cannot merge a merchant with itself';
  end if;

  select household_id into v_dup_household_id from merchants where id = p_duplicate_id;
  if v_dup_household_id is null then
    raise exception 'Global/system merchants cannot be merged away';
  end if;
  if not public.is_household_member(v_dup_household_id) then
    raise exception 'Not authorized to merge this merchant';
  end if;

  select household_id into v_canonical_household_id from merchants where id = p_canonical_id;
  if v_canonical_household_id is not null and v_canonical_household_id <> v_dup_household_id then
    raise exception 'Merchants must belong to the same household (the canonical side may be a global/system merchant)';
  end if;

  select count(*) into v_expense_count from expenses where merchant_id = p_duplicate_id and deleted_at is null;

  update merchants set parent_merchant_id = p_canonical_id where parent_merchant_id = p_duplicate_id;
  update recurring_expenses set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;
  update expenses set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;
  update expense_patterns set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;

  delete from merchants where id = p_duplicate_id;

  return jsonb_build_object('canonical_id', p_canonical_id, 'duplicate_id', p_duplicate_id, 'expenses_reassigned', v_expense_count);
end;
$$;

-- =========================================================
-- Part F — potential-duplicate finder (spec item 80: "Find duplicates")
-- =========================================================
-- Groups active categories/merchants by normalized name within the caller's
-- own visible scope (their household's own rows + global defaults), so the
-- UI can propose "Milk" + "Milk" or "DMart" + "D-Mart"-style groups without
-- the client ever pulling the full table and diffing it in JS.

create or replace function public.find_duplicate_categories(p_household_id uuid)
returns table (name_key text, category_ids uuid[], category_names text[], household_scoped boolean)
language sql
stable
security invoker
as $$
  select
    lower(trim(name)) as name_key,
    array_agg(id order by created_at) as category_ids,
    array_agg(name order by created_at) as category_names,
    bool_or(household_id is not null) as household_scoped
  from categories
  where is_active and (household_id is null or household_id = p_household_id)
  group by 1
  having count(*) > 1;
$$;

create or replace function public.find_duplicate_merchants(p_household_id uuid)
returns table (name_key text, merchant_ids uuid[], merchant_names text[], household_scoped boolean)
language sql
stable
security invoker
as $$
  select
    normalized_name as name_key,
    array_agg(id order by created_at) as merchant_ids,
    array_agg(name order by created_at) as merchant_names,
    bool_or(household_id is not null) as household_scoped
  from merchants
  where is_active and (household_id is null or household_id = p_household_id)
  group by 1
  having count(*) > 1;
$$;
