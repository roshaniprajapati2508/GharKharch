"use server";

// Couple activity feed (spec: Pillar 6, "chronological couple activity
// stream" - e.g. "Harsh added Petrol · 10 mins ago"). Deliberately reads a
// small, bounded, recency-ordered slice of raw expense rows for direct
// display - the same "bounded, not an aggregate" exception documented in
// insights.ts's getItemPriceMemory - rather than fetching a household's
// whole expense history into JS. This never sums or computes anything from
// the amounts; it only lists recent events, so the "aggregate in Postgres"
// rule doesn't apply here.

import { requireHouseholdContext, runAction } from "@/lib/actions/auth-helpers";

export type ActivityEventType = "added" | "edited" | "deleted";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  personName: string;
  itemName: string;
  amount: number;
  categoryName: string | null;
  /** ISO timestamp this event actually happened at (created_at / updated_at / deleted_at depending on type). */
  at: string;
}

// A row can only report one event here even though it may have both been
// edited and (later) deleted - deleted_at wins since it's the most recent
// and most significant thing that happened to it.
function classify(row: {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): { type: ActivityEventType; at: string } {
  if (row.deleted_at) return { type: "deleted", at: row.deleted_at };
  // updated_at is set on insert too, so only call it "edited" once it's
  // meaningfully after created_at (a few seconds of clock/write skew is not
  // an edit).
  const createdMs = new Date(row.created_at).getTime();
  const updatedMs = new Date(row.updated_at).getTime();
  if (updatedMs - createdMs > 5000) return { type: "edited", at: row.updated_at };
  return { type: "added", at: row.created_at };
}

/** Recent add/edit/delete activity across the household, newest first, for the dashboard activity feed. Bounded to `limit` rows - a feed, not a report. */
export async function getRecentActivity(limit = 15) {
  return runAction(async (): Promise<ActivityEvent[]> => {
    const { supabase, householdId } = await requireHouseholdContext();

    // Pull a bit more than `limit` from each of "recently touched" and
    // "recently deleted" since we re-sort the merged set below by whichever
    // timestamp actually matters for that row.
    const [activeRes, deletedRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("id, item_name, amount, created_by, category_id, created_at, updated_at, deleted_at")
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(limit),
      supabase
        .from("expenses")
        .select("id, item_name, amount, created_by, category_id, created_at, updated_at, deleted_at")
        .eq("household_id", householdId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit),
    ]);

    const rows = [...(activeRes.data ?? []), ...(deletedRes.data ?? [])];
    if (rows.length === 0) return [];

    const personIds = Array.from(new Set(rows.map((r) => r.created_by)));
    const categoryIds = Array.from(new Set(rows.map((r) => r.category_id).filter(Boolean)));

    const [{ data: profiles }, { data: cats }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", personIds),
      supabase.from("categories").select("id, name").in("id", categoryIds),
    ]);
    const personMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const categoryMap = new Map((cats ?? []).map((c) => [c.id, c.name]));

    const events: ActivityEvent[] = rows.map((r) => {
      const { type, at } = classify(r);
      return {
        id: r.id,
        type,
        personName: personMap.get(r.created_by) ?? "Someone",
        itemName: r.item_name,
        amount: parseFloat(r.amount as unknown as string),
        categoryName: categoryMap.get(r.category_id) ?? null,
        at,
      };
    });

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return events.slice(0, limit);
  });
}
