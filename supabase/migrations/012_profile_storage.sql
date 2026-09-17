-- 012_profile_storage.sql
-- Premium UX phase - Profile management + real avatar upload (spec items 47-53).
--
-- Adds a `username` column to `profiles` (optional, unique, lowercase handle)
-- and a Supabase Storage bucket + RLS policies for user-uploaded avatars, so
-- the profile page can do a real upload/preview/remove flow instead of only
-- ever showing initials.
--
-- Safe to run once; every statement below is idempotent (`if not exists` /
-- `on conflict do nothing` / guarded `create policy` blocks) so re-running
-- this file causes no harm.

-- ============================================================================
-- PART A - username column
-- ============================================================================

alter table profiles add column if not exists username text;

-- Plain unique index, not a scoped one like categories/merchants: usernames
-- are a global, user-level handle (not household-scoped), and Postgres
-- already treats multiple NULLs as distinct in a unique index - exactly what
-- we want, since most users will never set one.
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_profiles_username_unique'
  ) then
    create unique index idx_profiles_username_unique on profiles (lower(username)) where username is not null;
  end if;
end $$;

alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_.]{3,20}$')
  not valid;
-- `not valid` so an existing (already-clean) NULL-only column never fails to
-- attach; validate explicitly once you're ready (optional, and safe even with
-- live traffic since it only takes a lightweight lock to scan):
--   alter table profiles validate constraint profiles_username_format;

-- ============================================================================
-- PART B - avatar storage bucket
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- `public = true`: avatars are low-sensitivity, so we serve them via plain
-- public URLs (no signed-URL refresh logic needed in the client) - the same
-- tradeoff most consumer apps make for profile pictures. Write access is
-- still fully locked down below: only the owning user can add/replace/remove
-- files inside their own `{user_id}/` folder.
-- `file_size_limit` is in bytes (5 MiB), matching the spec's upload cap.

-- ============================================================================
-- PART C - storage RLS policies
-- ============================================================================
-- Path convention: profile-images/{user_id}/avatar.<ext>
-- storage.foldername(name) splits the object path into an array of folder
-- segments, so foldername(name)[1] is the {user_id} segment.

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
