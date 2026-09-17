-- GharKharch: household-manageable payment methods (spec section 35, 61)
-- expenses.payment_method stays a free-text column (see 001) — this table is the
-- source of truth for what shows up in the picker, and lets each household
-- rename/deactivate/add methods without a schema change.

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default 'wallet',
  is_default boolean not null default false, -- true = one of the 7 seeded defaults
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

comment on table payment_methods is 'Per-household payment method list. Seeded with 7 defaults on household creation; households can rename/deactivate/add their own.';

do $$
begin
  execute 'drop trigger if exists set_updated_at on payment_methods';
  execute 'create trigger set_updated_at before update on payment_methods for each row execute function public.set_updated_at()';
end $$;

alter table payment_methods enable row level security;

create policy "payment_methods: household access" on payment_methods
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create index if not exists idx_payment_methods_household on payment_methods (household_id, is_active);

-- =========================================================
-- Seed the 7 default payment methods whenever a household is created.
-- Implemented as an AFTER INSERT trigger on households (rather than editing
-- create_household(), which has already been run against the live project)
-- so this migration is purely additive.
-- =========================================================

create or replace function public.seed_default_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payment_methods (household_id, name, icon, is_default, sort_order)
  values
    (new.id, 'UPI', 'qr-code', true, 0),
    (new.id, 'Cash', 'banknote', true, 1),
    (new.id, 'Credit Card', 'credit-card', true, 2),
    (new.id, 'Debit Card', 'credit-card', true, 3),
    (new.id, 'Bank Transfer', 'building-2', true, 4),
    (new.id, 'Wallet', 'wallet', true, 5),
    (new.id, 'Other', 'more-horizontal', true, 6)
  on conflict (household_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_household_created_seed_payment_methods on households;
create trigger on_household_created_seed_payment_methods
  after insert on households
  for each row execute function public.seed_default_payment_methods();

-- Backfill: households created before this migration ran won't have fired the
-- trigger above. Safe to run unconditionally (on conflict do nothing).
insert into payment_methods (household_id, name, icon, is_default, sort_order)
select h.id, d.name, d.icon, true, d.sort_order
from households h
cross join (values
  ('UPI', 'qr-code', 0),
  ('Cash', 'banknote', 1),
  ('Credit Card', 'credit-card', 2),
  ('Debit Card', 'credit-card', 3),
  ('Bank Transfer', 'building-2', 4),
  ('Wallet', 'wallet', 5),
  ('Other', 'more-horizontal', 6)
) as d(name, icon, sort_order)
on conflict (household_id, name) do nothing;
