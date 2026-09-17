-- 017_receipts.sql
-- Multi-expense/Shopping Mode, "Analyze this expense", price-change detection
-- and receipt attachments/AI scanning phase.
--
-- Shopping mode, Analyze, and price-change detection need NO schema changes —
-- they reuse `expenses`, `createExpense`, and the existing breakdown functions
-- (`get_category_breakdown`, `get_merchant_breakdown`) entirely in application
-- code. This migration only adds what the receipts feature needs:
--   (a) a nullable `receipt_path` column on `expenses`
--   (b) a private Storage bucket `receipts` + RLS policies scoped by household
--
-- Safe to run once; every statement below is idempotent (`if not exists` /
-- `on conflict do nothing` / guarded `create policy` blocks) so re-running
-- this file causes no harm.

-- ============================================================================
-- PART A — receipt_path column
-- ============================================================================

-- `receipt_path` (not `receipt_url`): the bucket is PRIVATE (`public: false`),
-- so a plain public URL would never resolve. We store the object's *path*
-- inside the bucket (e.g. "{household_id}/{uuid}.jpg") and mint a short-lived
-- signed URL on demand, server-side, whenever the receipt is actually viewed
-- (see `getReceiptSignedUrl` in lib/actions/expenses.ts). Storing a path
-- instead of a signed URL means we never persist a URL that silently expires.
alter table expenses add column if not exists receipt_path text;

-- ============================================================================
-- PART B — receipts storage bucket
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- `public = false`: receipts are private financial documents, unlike avatars
-- (migration 012, which are `public = true`). Reads go through
-- `createSignedUrl()` (see PART C) rather than a public URL.
-- `file_size_limit` is in bytes (8 MiB — receipt photos run larger than
-- profile pictures).

-- ============================================================================
-- PART C — storage RLS policies
-- ============================================================================
-- Path convention: receipts/{household_id}/{uuid}.<ext>
-- storage.foldername(name) splits the object path into an array of folder
-- segments, so foldername(name)[1] is the {household_id} segment. Access is
-- scoped by household membership (via `is_household_member()`, from
-- 001_initial_schema.sql) rather than by uploader, matching how every other
-- household-scoped table in this app works — any member of the household can
-- see a receipt any other member attached, the same as they can see the
-- expense itself.

drop policy if exists "Household members can read their receipts" on storage.objects;
create policy "Household members can read their receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Household members can upload receipts" on storage.objects;
create policy "Household members can upload receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Household members can update their receipts" on storage.objects;
create policy "Household members can update their receipts"
  on storage.objects for update
  using (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Household members can delete their receipts" on storage.objects;
create policy "Household members can delete their receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );
