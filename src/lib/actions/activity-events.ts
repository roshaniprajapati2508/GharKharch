"use server";

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Unified Household Activity & Audit Inbox (spec: Module 3). A real,
// explicitly-logged event log - distinct from actions/activity.ts's
// getRecentActivity, which only *infers* recent activity by inspecting
// expense timestamps and can't log a rule firing or a budget alert, or
// track per-user read state. See migration 025 for the table/functions.

export type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];

export interface ActivityEventView extends ActivityEventRow {
  actorName: string | null;
  isRead: boolean;
}

/** Logs one activity event. Called from other server actions (expense create/update/delete, a Smart Rule auto-fill, a budget alert) - never awaited by the caller for anything but its own result, and any failure here must never fail the action that triggered it (see the try/catch call sites). */
export async function logActivityEvent(
  supabase: SupabaseClient<Database>,
  event: {
    householdId: string;
    actorId: string | null;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    isAlert?: boolean;
  }
) {
  await supabase.from("activity_events").insert({
    household_id: event.householdId,
    actor_id: event.actorId,
    event_type: event.eventType,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    summary: event.summary,
    metadata: event.metadata ?? {},
    is_alert: event.isAlert ?? false,
  });
}

/** Chronological activity for the inbox drawer and dedicated activity page, newest first, with each event's read state for the calling user and the actor's display name resolved. */
export async function getActivityEvents(options?: { limit?: number; filter?: "all" | "alerts" | "partner" | "expenses" | "rules" }) {
  return runAction(async (): Promise<ActivityEventView[]> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    const limit = options?.limit ?? 100;

    let query = supabase.from("activity_events").select("*").eq("household_id", householdId).order("created_at", { ascending: false }).limit(limit);
    if (options?.filter === "alerts") query = query.eq("is_alert", true);
    if (options?.filter === "expenses") query = query.eq("entity_type", "expense");
    if (options?.filter === "rules") query = query.eq("entity_type", "rule");
    const { data, error } = await query;
    if (error) throw new ActionError(error.message);

    let rows = data ?? [];
    if (options?.filter === "partner") rows = rows.filter((r) => r.actor_id && r.actor_id !== userId);

    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id)));
    const { data: profiles } = actorIds.length > 0 ? await supabase.from("profiles").select("id, display_name").in("id", actorIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return rows.map((r) => ({
      ...r,
      actorName: r.actor_id ? nameMap.get(r.actor_id) ?? "Someone" : null,
      isRead: (r.read_by ?? []).includes(userId),
    }));
  });
}

export async function getUnreadActivityCount() {
  return runAction(async (): Promise<number> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    const { data, error } = await supabase.from("activity_events").select("id, read_by").eq("household_id", householdId).limit(200);
    if (error) throw new ActionError(error.message);
    return (data ?? []).filter((r) => !(r.read_by ?? []).includes(userId)).length;
  });
}

export async function markActivityEventRead(eventId: string) {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    const { error } = await supabase.rpc("mark_activity_read", { p_event_id: eventId });
    if (error) throw new ActionError(error.message);
    return true;
  });
}

export async function markAllActivityRead() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.rpc("mark_all_activity_read", { p_household_id: householdId });
    if (error) throw new ActionError(error.message);
    return true;
  });
}
