-- GharKharch: fast fuzzy search (spec section 20, 21, 64)
-- Global search across item name / notes / merchant name uses ILIKE from the
-- app; pg_trgm + GIN indexes make that fast even as the expenses table grows
-- (spec section 72 - must stay responsive at 10k-50k+ rows).

create extension if not exists pg_trgm;

create index if not exists idx_expenses_item_name_trgm
  on expenses using gin (item_name gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_expenses_notes_trgm
  on expenses using gin (notes gin_trgm_ops)
  where deleted_at is null and notes is not null;

create index if not exists idx_merchants_name_trgm
  on merchants using gin (name gin_trgm_ops);

-- Amount-range and payment-method filters (spec section 21, 22)
create index if not exists idx_expenses_household_payment_method
  on expenses (household_id, payment_method)
  where deleted_at is null;

create index if not exists idx_expenses_household_amount
  on expenses (household_id, amount)
  where deleted_at is null;
