-- =========================================================
-- Migration 013 — expose per-entry ownership from the duplicate finder
-- =========================================================
-- Bug fix: the "Find duplicates" merge dialog (migration 011, spec items
-- 39, 45-46, 80) let the person pick *any* member of a duplicate group as
-- the one to keep, including when the group mixes a global/system default
-- with the household's own copy. merge_categories()/merge_merchants()
-- correctly refuse to delete a global default (by design — see 011's Part
-- E comment), but the client had no way to know which id was the global
-- one, so choosing the household copy as "keep" always failed with a
-- confusing "Global default categories cannot be merged away" error and no
-- way to recover except guessing again.
--
-- Fix: find_duplicate_categories() / find_duplicate_merchants() now also
-- return an `is_global` boolean array, parallel to the ids/names arrays, so
-- the client can identify the global entry, default the merge selection to
-- it (it's always a safe, valid canonical choice), and disable picking
-- anything else when one is present — instead of letting the person hit
-- the error at all.
--
-- Return-type change means these can't be `create or replace`d in place;
-- drop first, matching Postgres's rules for functions returning a table.

drop function if exists public.find_duplicate_categories(uuid);
drop function if exists public.find_duplicate_merchants(uuid);

create function public.find_duplicate_categories(p_household_id uuid)
returns table (name_key text, category_ids uuid[], category_names text[], household_scoped boolean, is_global boolean[])
language sql
stable
security invoker
as $$
  select
    lower(trim(name)) as name_key,
    array_agg(id order by created_at) as category_ids,
    array_agg(name order by created_at) as category_names,
    bool_or(household_id is not null) as household_scoped,
    array_agg(household_id is null order by created_at) as is_global
  from categories
  where is_active and (household_id is null or household_id = p_household_id)
  group by 1
  having count(*) > 1;
$$;

create function public.find_duplicate_merchants(p_household_id uuid)
returns table (name_key text, merchant_ids uuid[], merchant_names text[], household_scoped boolean, is_global boolean[])
language sql
stable
security invoker
as $$
  select
    normalized_name as name_key,
    array_agg(id order by created_at) as merchant_ids,
    array_agg(name order by created_at) as merchant_names,
    bool_or(household_id is not null) as household_scoped,
    array_agg(household_id is null order by created_at) as is_global
  from merchants
  where is_active and (household_id is null or household_id = p_household_id)
  group by 1
  having count(*) > 1;
$$;

comment on function public.find_duplicate_categories(uuid) is 'Groups this household''s visible categories (own + global defaults) by normalized name; is_global marks which array entries are global defaults so the client can pin the merge''s canonical side to one instead of letting the person pick an invalid combination.';
comment on function public.find_duplicate_merchants(uuid) is 'Groups this household''s visible merchants (own + global/system) by normalized name; is_global marks which array entries are global/system so the client can pin the merge''s canonical side to one instead of letting the person pick an invalid combination.';
