-- GharKharch: Unified Household Activity & Audit Inbox (spec: Module 3 /
-- Developer Implementation Brief). A real, explicitly-logged audit table -
-- distinct from the existing ActivityFeedCard on the dashboard, which only
-- *infers* recent add/edit/delete events by inspecting an expense row's
-- created_at/updated_at/deleted_at timestamps (see getRecentActivity in
-- actions/activity.ts). That inference can't represent anything that
-- isn't itself an expense row (a Smart Rule firing, a budget alert), and
-- can't track per-user "read" state. This table can.
--
-- read_by is a plain array of user ids rather than a join table: with
-- exactly two members per household (spec section - this is a two-person
-- household app), a join table would be pure overhead for what's always a
-- 0-2 element set: "has partner A opened the inbox since this event fired,
-- has partner B."

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_alert boolean not null default false,
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_events_household on activity_events(household_id, created_at desc);
create index if not exists idx_activity_events_alert on activity_events(household_id, is_alert) where is_alert;

alter table activity_events enable row level security;

create policy "activity_events_select" on activity_events
  for select using (public.is_household_member(household_id));

create policy "activity_events_insert" on activity_events
  for insert with check (public.is_household_member(household_id));

-- Only ever updated to append the caller's own id to read_by (see
-- mark_activity_read / mark_all_activity_read below) - never to change
-- what happened, so there's no separate "update your own event" policy;
-- members can update any event in their household (to mark it read),
-- but the app only ever calls the two functions below to do so.
create policy "activity_events_update" on activity_events
  for update using (public.is_household_member(household_id));

comment on table activity_events is
  'Real, explicitly-logged audit trail (migration 025) - expense create/update/delete, Smart Rule auto-fills, and budget alerts, each with per-user read state (read_by). Distinct from the dashboard''s ActivityFeedCard, which only infers events from expense timestamps.';

-- Marks one event as read by the calling user (idempotent - appending an
-- id already in the array is a no-op via the "not in" guard). SECURITY
-- INVOKER (default) so it only ever touches rows the caller's own RLS
-- policies already let them see.
create function public.mark_activity_read(p_event_id uuid)
returns void
language sql
as $$
  update activity_events
  set read_by = read_by || array[auth.uid()]
  where id = p_event_id
    and not (auth.uid() = any(read_by));
$$;

-- Marks every current event in a household as read by the calling user in
-- one round trip ("Mark all as read").
create function public.mark_all_activity_read(p_household_id uuid)
returns void
language sql
as $$
  update activity_events
  set read_by = read_by || array[auth.uid()]
  where household_id = p_household_id
    and not (auth.uid() = any(read_by));
$$;

comment on function public.mark_activity_read is 'Appends the calling user to one activity_events row''s read_by (migration 025).';
comment on function public.mark_all_activity_read is 'Appends the calling user to every activity_events row''s read_by for a household in one statement - backs the inbox''s "Mark all as read" (migration 025).';
