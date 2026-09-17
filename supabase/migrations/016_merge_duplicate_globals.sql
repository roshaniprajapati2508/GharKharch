-- =========================================================
-- Migration 016 - allow merging duplicate global default categories/merchants
-- =========================================================
-- Bug fix: merge_categories() and merge_merchants() in migration 011
-- raised "Global default categories cannot be merged away" if the duplicate
-- side had household_id is null. If a remote database had seeded global
-- defaults multiple times (e.g. duplicate "Accessories" or duplicate merchants),
-- households could not merge those duplicate global rows away.
--
-- Fix: When both p_canonical_id and p_duplicate_id are global defaults (household_id IS NULL),
-- merging them into a single global row is now explicitly allowed. All dependent
-- references (expenses, categories, merchants, recurring rules, budgets, patterns)
-- are updated to point to the canonical row, and the redundant duplicate global row is safely removed.

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
  select household_id into v_canonical_household_id from categories where id = p_canonical_id;

  -- If both are global defaults, allow merging duplicate globals.
  if v_dup_household_id is null and v_canonical_household_id is null then
    null;
  elsif v_dup_household_id is null then
    raise exception 'Global default categories cannot be merged away into a household category';
  elsif not public.is_household_member(v_dup_household_id) then
    raise exception 'Not authorized to merge this category';
  elsif v_canonical_household_id is not null and v_canonical_household_id <> v_dup_household_id then
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
  select household_id into v_canonical_household_id from merchants where id = p_canonical_id;

  -- If both are global defaults, allow merging duplicate globals.
  if v_dup_household_id is null and v_canonical_household_id is null then
    null;
  elsif v_dup_household_id is null then
    raise exception 'Global default merchants cannot be merged away into a household merchant';
  elsif not public.is_household_member(v_dup_household_id) then
    raise exception 'Not authorized to merge this merchant';
  elsif v_canonical_household_id is not null and v_canonical_household_id <> v_dup_household_id then
    raise exception 'Merchants must belong to the same household (the canonical side may be a global default)';
  end if;

  select count(*) into v_expense_count from expenses
    where merchant_id = p_duplicate_id and deleted_at is null;

  update merchants set parent_merchant_id = p_canonical_id where parent_merchant_id = p_duplicate_id;
  update merchant_aliases set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;
  update recurring_expenses set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;
  update expenses set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;
  update expense_patterns set merchant_id = p_canonical_id where merchant_id = p_duplicate_id;

  delete from merchants where id = p_duplicate_id;

  return jsonb_build_object('canonical_id', p_canonical_id, 'duplicate_id', p_duplicate_id, 'expenses_reassigned', v_expense_count);
end;
$$;

comment on function public.merge_categories(uuid, uuid) is 'Reassigns every dependent reference from duplicate_id to canonical_id and deletes duplicate_id. Allows merging duplicate global categories as well as household categories.';
comment on function public.merge_merchants(uuid, uuid) is 'Reassigns every dependent reference from duplicate_id to canonical_id and deletes duplicate_id. Allows merging duplicate global merchants as well as household merchants.';
