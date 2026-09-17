-- GharKharch: performance indexes for common query patterns

create index if not exists idx_household_members_household on household_members (household_id);
create index if not exists idx_household_members_user on household_members (user_id);

create index if not exists idx_categories_household on categories (household_id);
create index if not exists idx_categories_parent on categories (parent_id);

create index if not exists idx_merchants_household on merchants (household_id);
create index if not exists idx_merchants_normalized_name on merchants (household_id, normalized_name);

create index if not exists idx_expenses_household on expenses (household_id);
create index if not exists idx_expenses_expense_date on expenses (expense_date);
create index if not exists idx_expenses_category on expenses (category_id);
create index if not exists idx_expenses_merchant on expenses (merchant_id);
create index if not exists idx_expenses_paid_by on expenses (paid_by);
create index if not exists idx_expenses_created_at on expenses (created_at);
create index if not exists idx_expenses_household_date on expenses (household_id, expense_date) where deleted_at is null;
create index if not exists idx_expenses_household_category on expenses (household_id, category_id) where deleted_at is null;
create index if not exists idx_expenses_household_merchant on expenses (household_id, merchant_id) where deleted_at is null;

create index if not exists idx_recurring_household on recurring_expenses (household_id);
create index if not exists idx_recurring_active on recurring_expenses (household_id, active);

create index if not exists idx_patterns_household on expense_patterns (household_id);
create index if not exists idx_patterns_merchant on expense_patterns (household_id, merchant_id);
create index if not exists idx_patterns_item_name on expense_patterns (household_id, item_name);

create index if not exists idx_budgets_household_period on budgets (household_id, period_month);
