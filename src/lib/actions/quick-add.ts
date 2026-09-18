"use server";

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { rankQuickAddCandidates } from "@/lib/expense-intelligence/quick-add-suggester";
import { getTodayISO, parseISODate } from "@/lib/date-utils";

export interface QuickAddChip {
  itemName: string;
  merchantId: string | null;
  merchantName: string | null;
  categoryId: string;
  subcategoryId: string | null;
  amount: number;
}

/**
 * Scored Quick Add chips (spec sections 9, 10, 80) - ranked by the
 * recency/frequency/weekday/user-preference/merchant-frequency formula in
 * lib/expense-intelligence/quick-add-suggester.ts, not just "most recent."
 */
export async function getQuickAddChips(limit = 6) {
  return runAction(async () => {
    const { supabase, householdId, userId } = await requireHouseholdContext();

    const { data: patterns, error } = await supabase
      .from("expense_patterns")
      .select("item_name, merchant_id, category_id, subcategory_id, average_amount, usage_count, last_used_at, user_id")
      .eq("household_id", householdId)
      .not("last_used_at", "is", null)
      .order("last_used_at", { ascending: false })
      .limit(60); // candidate pool the ranker scores from, not the final chip count

    if (error) throw new ActionError(error.message);
    // item_name is nullable in the schema, but every pattern created via
    // upsertExpensePattern always sets it - filter defensively rather than
    // widening the ranker's input type for a case that shouldn't occur.
    const namedPatterns = (patterns ?? []).filter((p): p is typeof p & { item_name: string } => p.item_name !== null);
    if (namedPatterns.length === 0) return [] as QuickAddChip[];

    const todayWeekday = parseISODate(getTodayISO()).getUTCDay();
    const { data: affinityRows } = await supabase.rpc("get_item_weekday_affinity", {
      p_household_id: householdId,
      p_weekday: todayWeekday,
    });
    const weekdayAffinity = new Map((affinityRows ?? []).map((r) => [r.item_name, parseFloat(r.affinity)]));

    // Top-level category names, purely for the time-of-day boost (spec:
    // Time-of-Day Contextual Prioritizer) - e.g. lift Food & Grocery
    // patterns in the morning, Homemade Business during the day.
    const candidateCategoryIds = Array.from(new Set(namedPatterns.map((p) => p.category_id)));
    const { data: categoryRows } = candidateCategoryIds.length
      ? await supabase.from("categories").select("id, name").in("id", candidateCategoryIds)
      : { data: [] };
    const categoryNames = new Map((categoryRows ?? []).map((c) => [c.id, c.name]));

    const ranked = rankQuickAddCandidates(namedPatterns, { currentUserId: userId, weekdayAffinity, categoryNames, limit });

    const merchantIds = ranked.map((r) => r.merchantId).filter((id): id is string => !!id);
    const { data: merchants } = merchantIds.length
      ? await supabase.from("merchants").select("id, name").in("id", merchantIds)
      : { data: [] };
    const merchantMap = new Map((merchants ?? []).map((m) => [m.id, m.name]));

    return ranked.map((r) => ({
      itemName: r.itemName,
      merchantId: r.merchantId,
      merchantName: r.merchantId ? merchantMap.get(r.merchantId) ?? null : null,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId,
      amount: r.amount,
    })) as QuickAddChip[];
  });
}
