# GharKharch database migrations

Run these in the Supabase SQL Editor (or via `supabase db push` if you link the
project with the CLI), **in this exact order**. Each file is idempotent-ish where
possible (`if not exists`, `on conflict do nothing`), but they are not meant to be
re-run out of order or skipped.

**Per standing policy: Claude never runs these against your live project.** They
are prepared here, complete and ready, for you to copy/paste or import yourself.

## Status as of this build

| # | File | Status |
|---|------|--------|
| 001 | `001_initial_schema.sql` | Already run against your live project |
| 002 | `002_rls.sql` | Already run against your live project |
| 003 | `003_indexes.sql` | Already run against your live project |
| 004 | `004_seed_categories.sql` | Already run against your live project (see known bug note in the file itself — cleaned up by 011) |
| 005 | `005_payment_methods.sql` | Already run against your live project |
| 006 | `006_analytics_functions.sql` | Already run against your live project |
| 007 | `007_search_indexes.sql` | Already run against your live project |
| 008 | `008_commerce_ecosystem.sql` | Already run against your live project |
| 009 | `009_seed_commerce_catalogue.sql` | Already run against your live project |
| 010 | `010_intelligence_functions.sql` | Already run against your live project |
| 011 | `011_dedup_and_merge.sql` | Not yet run — needs to be applied (new, this phase) |
| 012 | `012_profile_storage.sql` | Not yet run — needs to be applied (new, this phase) |
| 013 | `013_duplicate_finder_ownership.sql` | Not yet run — needs to be applied (bug fix) |
| 015 | `015_analytics_enhancements.sql` | Not yet run — needs to be applied (new, this phase) |
| 016 | `016_intelligence_and_payment_depth.sql` | Not yet run — needs to be applied (new, this phase) |
| 017 | `017_receipts.sql` | Not yet run — needs to be applied (new, this phase) |
| 018 | `018_merge_duplicate_globals.sql` | Not yet run — needs to be applied (bug fix; renumbered from a conflicting "016" filename found alongside this phase's own 016 — see the dependency note below) |

Run **011** then **012** next to bring your database up to date with the
Premium UX phase's duplicate-category cleanup/merge tooling and the new
profile/avatar upload feature.

## What each file does

**001_initial_schema.sql** — Core tables (`households`, `household_members`,
`profiles`, `user_preferences`, `categories`, `merchants`, `recurring_expenses`,
`expenses`, `expense_patterns`, `budgets`), the `updated_at` trigger, the
`handle_new_user` trigger that bootstraps a profile + preferences row on signup,
and three functions: `is_household_member()` (RLS helper), `create_household()`
and `join_household_by_code()` (the only way membership rows are ever created —
see 002 for why).

**002_rls.sql** — Enables Row Level Security on every household-scoped table and
adds the policies that restrict each one to members of that household, using the
`is_household_member()` helper from 001 to avoid self-referencing-policy
recursion. `household_members` deliberately has no client-facing insert/update/
delete policy — membership changes only happen through the SECURITY DEFINER
functions in 001.

**003_indexes.sql** — Performance indexes on `expenses`, `merchants`,
`categories`, `household_members`, `recurring_expenses`, `expense_patterns`, and
`budgets`, matching the app's actual query patterns (household + date, household
+ category, household + merchant, etc.).

**004_seed_categories.sql** — Inserts the default (global, `household_id is
null`) category tree: Food & Grocery, Shopping, Fashion, Electronics, Household,
Transport, Health, Personal, Entertainment, Bills & Utilities, plus each of their
subcategories. These are visible to every household but not editable by them;
households add their own categories alongside these (with `household_id` set).

**005_payment_methods.sql** *(new)* — Adds a `payment_methods` table so each
household can rename/deactivate/add payment methods (spec section 35, 61)
instead of the option list being hard-coded. Seeds the 7 defaults (UPI, Cash,
Credit Card, Debit Card, Bank Transfer, Wallet, Other) via an `AFTER INSERT`
trigger on `households` — implemented as a new trigger rather than editing
`create_household()` (already run live) so this migration stays purely additive.
Also includes a one-time backfill `insert ... on conflict do nothing` so any
household created before this migration runs still gets the 7 defaults the
moment you run it. `expenses.payment_method` itself is unchanged — still a free
text column; this table only powers the picker UI.

**006_analytics_functions.sql** *(new)* — Seven read-only SQL aggregation
functions that back the dashboard, analytics and reports screens (spec sections
7, 8, 23-32, 50, 69): `get_expense_summary`, `get_category_breakdown`,
`get_person_breakdown`, `get_merchant_breakdown`, `get_item_analytics`,
`get_daily_spending`, `get_top_expenses`. All are `stable` SQL functions that run
with the *caller's* privileges (Postgres default), so the existing RLS policies
on `expenses`/`categories`/`merchants` still apply on top of the `household_id`
parameter — a user can't get another household's numbers by passing a different
id. This keeps every aggregation in Postgres instead of pulling raw transactions
into the browser (spec section 48-50, 72).

**007_search_indexes.sql** *(new)* — Adds the `pg_trgm` extension and GIN
trigram indexes on `expenses.item_name`, `expenses.notes` and `merchants.name`
so free-text search (spec section 20, 21, 64) stays fast as transaction volume
grows, plus two extra composite indexes for the amount-range and payment-method
filters on the Expenses screen (spec section 21-22).

**008_commerce_ecosystem.sql** *(new)* — Implements the "Indian Commerce,
Payment & Bill Ecosystem" addendum:
- Upgrades `merchants` from household-only to the same global-catalogue-or-household
  pattern as `categories` (`household_id` is now nullable = system merchant,
  visible to everyone but not editable by any household), and adds
  `merchant_type`, `channel` (online/offline/mixed), `aliases` (text[], e.g.
  `{"insta","swiggy instamart"}` → Swiggy Instamart), `parent_merchant_id`
  (e.g. Swiggy Instamart under Swiggy), `is_system`, `logo_url`. RLS is updated
  to match: everyone can read global rows, only a household can write its own.
- Adds the card catalogue (`card_issuers`, `card_products`) as system data
  readable by any authenticated user, plus `user_cards` — a household's own
  cards, storing **only** issuer/product/variant/network/last4/credit
  limit/statement & due day. Never a card number, CVV, PIN, or any credential.
- Adds `bank_accounts` and `upi_profiles` — identifier-only registries (last
  2-4 digits, bank name, UPI app label). Never a credential.
- Adds the bills module: `bill_providers` (system + household, same pattern as
  categories/merchants) and `bills` (amount, billing period, due/paid dates,
  status, optional recurring frequency, optional `linked_expense_id` so a
  "mark as paid" action can create a real expense without double-counting).
- Adds optional `card_id` / `upi_profile_id` / `bank_account_id` columns on
  `expenses`, with a check constraint allowing at most one to be set — lets an
  expense optionally record *which* card/UPI/bank account paid for it, on top
  of the existing free-text `payment_method`.
- Seeds one new subcategory (`Advertising & Marketing` under the global
  `Personal` category) and a system `Meta Ads` merchant, per the addendum's
  note about tracking ad spend (Meta/Google Ads, social campaigns, etc.).

**009_seed_commerce_catalogue.sql** *(new)* — Seeds the global system
merchant catalogue (quick-commerce/grocery delivery, food delivery, shopping
marketplaces, entertainment/movies, cabs, Google Ads), a starter set of card
issuers (HDFC, ICICI, SBI, Axis, Kotak, IDFC FIRST, Amex, Other) with a
handful of well-known card products per issuer, and system bill providers
(Gujarat electricity boards + Torrent Power, LPG providers, water, internet/
mobile carriers, DTH, society maintenance). All of this is a starting point —
every household can rename, deactivate, or add its own on top; nothing here
is hard-coded into the frontend (spec addendum section 45).

**010_intelligence_functions.sql** *(new)* — Two more read-only SQL functions
backing the Quick Add and recurring-expense-detection features (spec sections
9-11, 80): `get_item_weekday_affinity` (how often an item is bought on a given
weekday, for weekday-pattern scoring) and `get_item_gap_consistency` (average
days between purchases of the same item, using `LAG() OVER` + `stddev_samp`, so
a consistent cadence like "every ~7 days" can be told apart from an item bought
at random intervals). Same `stable`/caller-privileges pattern as 006 — RLS still
applies, no raw expense rows are pulled into the browser.

**011_dedup_and_merge.sql** *(new, Premium UX phase)* — Fixes the duplicate
global-category bug (see the note at the top of `004_seed_categories.sql`):
one-time idempotent cleanup that finds duplicate global categories/merchants,
picks the oldest row as canonical, reassigns every dependent reference
(expenses, subcategories, merchants, recurring expenses, budgets, expense
patterns) to it, then deletes the duplicate. Adds
`idx_categories_unique_scope`, a scoped unique index (using `coalesce` to
treat repeated `NULL`s in `household_id`/`parent_id` as the same bucket) so
this class of bug fails loudly instead of silently duplicating again. Also
adds four functions the new "Find duplicates" UI calls:
`find_duplicate_categories` / `find_duplicate_merchants` (read-only, RLS-scoped,
list potential duplicate groups) and `merge_categories` / `merge_merchants`
(`security definer`, but independently re-checks that the duplicate being
removed belongs to the caller's own household before touching anything — a
global/system category or merchant can only ever be the *canonical* side of a
merge, never the one deleted).

**012_profile_storage.sql** *(new, Premium UX phase)* — Adds an optional,
unique `username` column to `profiles` (a plain unique index, not a
household-scoped one — usernames are per-user, and Postgres already treats
multiple `NULL`s as distinct so this doesn't block users who never set one),
plus a public-read `profile-images` Storage bucket (5 MiB limit,
image/jpeg|png|webp|gif only) with RLS policies so a user can only
insert/update/delete objects inside their own `{user_id}/` folder
(`profile-images/{user_id}/avatar.<ext>`). Backs the new real avatar
upload/preview/remove flow on the Profile page — no more initials-only
avatars. Every statement is idempotent and safe to re-run.

**015_analytics_enhancements.sql** *(new)* — Closes several analytics gaps
found by the "maximum options" wishlist audit. `get_merchant_breakdown` gains
`lowest_transaction` (mirroring the category breakdown's existing column) and
`share_pct` (this merchant's total as a % of the household's grand total for
the period, computed via a CTE so it's one round trip, not two) — dropped and
recreated since Postgres won't `CREATE OR REPLACE` a function whose return
columns change. New `get_merchant_monthly_trend(p_household_id, p_merchant_id,
p_months default 6)` returns one row per trailing month (zero-filled) for a
small trend sparkline. `get_item_analytics` similarly gains
`estimated_monthly_spend` (total spend normalized to a 30-day rate, guarded
the same way `avg_gap_days` already is against a tiny sample). New
`get_payment_method_breakdown(p_household_id, p_start, p_end)` groups by the
existing free-text `expenses.payment_method` column. Same `stable`,
caller-privileges pattern as 006 — RLS still applies, no raw expense rows
reach the browser.

**016_intelligence_and_payment_depth.sql** *(new)* — Backs the Spending
Intelligence section and deeper payment analytics (batch phase). Adds
`get_category_monthly_trend(p_household_id, p_category_id, p_months default
6)`, mirroring `get_merchant_monthly_trend` (015) exactly, for a small
per-category trend sparkline. Adds `get_merchant_category_share
(p_household_id, p_merchant_id, p_start, p_end)`, a number distinct from
`get_merchant_breakdown`'s existing `share_pct` (share of the household grand
total) — this one returns, per category the merchant has spend in during the
period, that merchant's share of *that category's* total spend. Adds
`get_spending_by_weekday(p_household_id, p_start, p_end)` (groups by
`extract(dow from expense_date)`) and `get_expense_type_breakdown
(p_household_id, p_start, p_end)` (groups by the existing `expense_type` enum:
personal/household/shared) for the Spending Intelligence page. Adds
`get_recurring_vs_oneoff(p_household_id, p_start, p_end)`, splitting period
spend by whether `expenses.recurring_rule_id` is set. Adds
`get_card_breakdown` and `get_upi_breakdown` (both `p_household_id, p_start,
p_end`), joining `expenses.card_id` / `expenses.upi_profile_id` (migration
008) to `user_cards` / `upi_profiles` for a total/count per card or UPI
profile — distinct from `get_payment_method_breakdown`'s free-text
`payment_method` grouping. Same `stable`, caller-privileges pattern as
006/015 — RLS still applies, no raw expense rows reach the browser. No
schema/table changes — functions only.

**017_receipts.sql** *(new)* — Backs receipt attachments + AI receipt
scanning. Shopping mode, "Analyze this expense", and price-change detection
need no schema changes at all (they're pure application code reusing
`createExpense` and the existing breakdown functions/queries), so this is the
only migration this phase needs. Adds a nullable `receipt_path` column on
`expenses` (a Storage object *path*, not a URL — the bucket is private, so a
public URL would never resolve; a signed URL is minted on demand instead), and
a private (`public: false`) `receipts` Storage bucket (8 MiB limit,
image/jpeg|png|webp|heic) with RLS policies scoped by **household membership**
(via `is_household_member()`, unlike the `profile-images` bucket from 012
which is scoped by individual `{user_id}`) so any member of the household can
read/write a receipt under `receipts/{household_id}/...`, matching how every
other household-scoped resource in this app already works. Every statement is
idempotent and safe to re-run.

**018_merge_duplicate_globals.sql** *(bug fix, renumbered)* — Fixes
`merge_categories()`/`merge_merchants()` (first defined in migration 011):
they previously raised "Global default categories cannot be merged away" if
the *duplicate* side of a merge was itself a global default (`household_id is
null`) — meaning if a remote database ever ended up with duplicate global
rows (e.g. two "Accessories" categories, or two identical system merchants),
the "Find duplicates" merge tool could never clean them up. This migration
allows merging two global defaults into one, reassigning every dependent
reference (expenses, categories, merchants, recurring rules, budgets,
patterns) to the surviving row, exactly as 011 already does for
household-owned duplicates. This file was originally created as another
`016_...sql` alongside this phase's own `016_intelligence_and_payment_depth.sql`
— a genuine numbering collision between two pieces of work done around the
same time — and has been renumbered to 018 (after 017) so the migrations stay
strictly sequential; its content is unchanged from the original file, only
the filename and this header comment changed.

## Dependencies / notes

- 002 depends on 001 (uses `is_household_member()` and the tables it creates).
- 003 depends on 001 (indexes reference columns created there).
- 004 depends on 001 (inserts into `categories`, looks up parent rows by name).
- 005 depends on 001 (`households`, `set_updated_at()`, `is_household_member()`).
- 006 depends on 001 (all the tables it aggregates over) and 002 (relies on RLS
  already being enabled — these functions do not bypass it).
- 007 depends on 001 (`expenses`, `merchants` columns).
- 008 depends on 001 (`merchants`, `expenses`, `households`, `set_updated_at()`,
  `is_household_member()`) and 004 (looks up the `Personal` category by name
  to attach the new `Advertising & Marketing` subcategory).
- 009 depends on 008 (all the tables/columns it seeds into).
- 010 depends on 001 (`expenses`, `expense_patterns`) and 002 (relies on RLS
  already being enabled).
- 011 depends on 001 (`categories`, `merchants`, and everything that
  references them) and 004/008/009 having already run (it's specifically
  cleaning up damage those seed steps could cause if re-run). Safe to run
  even if no duplicates exist — every step is a no-op in that case.
- `create_household()` (in 001) also seeds ~16 common Indian merchants mapped to
  the global subcategories from 004 — so a household created *before* 004 has run
  will simply get merchants with no subcategory match (harmless; they just won't
  have a category pre-assigned until you run 004).
- None of these files touch `auth.users` except to reference it via foreign keys
  and the `on_auth_user_created` trigger — no existing auth data is modified.
- 012 depends on 001 (`profiles` table) and creates its own storage bucket —
  no dependency on 002-011. Safe to run any time after 001.
- 013 depends on 011 (drops and recreates `find_duplicate_categories` /
  `find_duplicate_merchants`, first defined there) — no schema/table changes,
  just a return-type fix on those two functions. Safe to run any time after 011.
- 015 depends on 001 (`expenses`, `merchants`) and 006 (drops and recreates
  `get_merchant_breakdown` and `get_item_analytics`, first defined there, and
  relies on RLS already being enabled from 002). No schema/table changes —
  functions only. Safe to run any time after 006.
- 016 depends on 001 (`expenses`, `categories`), 008 (`user_cards`,
  `upi_profiles`, `expenses.card_id`/`upi_profile_id`), and 015 (mirrors
  `get_merchant_monthly_trend`'s pattern). No schema/table changes — functions
  only. Safe to run any time after 008.
- 017 depends on 001 (`expenses` table, `is_household_member()`) and 002
  (relies on RLS already being enabled on `expenses`; `storage.objects`'
  RLS is enabled by Supabase itself). No dependency on 003-016. Safe to run
  any time after 001.
- 018 depends on 011 (redefines `merge_categories`/`merge_merchants`, first
  created there) and 001 (`is_household_member()`, `categories`/`merchants`
  and everything that references them). No dependency on 012-017 — safe to
  run any time after 011, including before 015/016/017 if you'd rather apply
  it earlier since it's an independent bug fix, not new functionality.
- 022 depends on 001 (`expenses`, `categories`) and matches 021's business-
  scope convention (matches "Homemade Business" by name, not id). Adds a new
  `entry_type` column to `expenses` (default 'expense', so every existing
  row is unaffected) plus a new `get_business_pnl()` function for the Mini
  P&L widget - income vs. business expense for a date range. No dependency
  on 019/020/021 beyond both matching categories by the same name. Safe to
  run any time after 001.
- 021 and 022 were edited in place after first being written (both were
  still un-run, so this is safe - nothing has executed against your project
  yet): 021's 7 functions now also exclude `entry_type = 'income'` rows from
  every spend total (an expense-only column added by 022, authored after
  021), and 022's get_business_pnl now scopes "business income" to the
  Homemade Business tree / "Business Sales & Payouts" category specifically,
  rather than counting every income row - needed once 023 adds general
  household income (Salary, Freelancing) that must NOT count as this
  business's own income. If you already ran 021/022 before reading this,
  tell Claude and it'll prepare a follow-up migration instead of relying on
  the in-place edit.
- 023 depends on 001 (`categories.type`, unused for 'income' until now) and
  022 (`expenses.entry_type`). Seeds 3 global income categories (Salary,
  Freelancing & Consulting, Business Sales & Payouts) and 5 global
  marketplace/client merchants (Amazon/Flipkart/Meesho Seller Payout,
  Website Orders, Freelance Client), and adds get_income_summary() for the
  dashboard's total-inflow card. Safe to run any time after 022.
- As always: Claude prepares these files only. Running them against your live
  Supabase project is entirely up to you, via the SQL Editor or the CLI.
