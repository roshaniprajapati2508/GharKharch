"use server";

// Server-action layer for lib/expense-intelligence/* — every DB read lives
// here; the suggesters themselves stay pure functions (see their own file
// headers for why).

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { suggestCategory, type PatternAggregate, type CategorySuggestion } from "@/lib/expense-intelligence/category-suggester";
import { detectRecurringCandidates, type RecurringCandidate } from "@/lib/expense-intelligence/recurring-detector";
import { getMonthRange } from "@/lib/date-utils";
import type { Tables } from "@/types/database";

function topAggregate(rows: { category_id: string; subcategory_id: string | null; usage_count: number }[]): PatternAggregate | null {
  const byCategory = new Map<string, PatternAggregate>();
  for (const row of rows) {
    const key = `${row.category_id}::${row.subcategory_id ?? ""}`;
    const existing = byCategory.get(key);
    if (existing) {
      existing.usage_count += row.usage_count;
    } else {
      byCategory.set(key, { category_id: row.category_id, subcategory_id: row.subcategory_id, usage_count: row.usage_count });
    }
  }
  const sorted = Array.from(byCategory.values()).sort((a, b) => b.usage_count - a.usage_count);
  return sorted[0] ?? null;
}

/** Category suggestion for the item-name field in the Add Expense sheet (spec section 12, 19). */
export async function getCategorySuggestion(itemName: string, merchantId: string | null): Promise<{ data: CategorySuggestion | null; error: string | null }> {
  const result = await runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const normalized = itemName.trim().toLowerCase();
    if (!normalized) return null;

    const [exactRes, byItemRes, byMerchantRes, categoriesRes, overallRes] = await Promise.all([
      merchantId
        ? supabase
            .from("expense_patterns")
            .select("category_id, subcategory_id, usage_count")
            .eq("household_id", householdId)
            .eq("item_name", normalized)
            .eq("merchant_id", merchantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("expense_patterns")
        .select("category_id, subcategory_id, usage_count")
        .eq("household_id", householdId)
        .eq("item_name", normalized)
        .limit(20),
      merchantId
        ? supabase
            .from("expense_patterns")
            .select("category_id, subcategory_id, usage_count")
            .eq("household_id", householdId)
            .eq("merchant_id", merchantId)
            .limit(20)
        : Promise.resolve({ data: [] }),
      listCategoriesForHousehold(),
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: getMonthRange(2).start, p_end: getMonthRange(0).end }),
    ]);

    if (!categoriesRes.data) throw new ActionError("Couldn't load categories");

    const overallTop = (overallRes.data ?? [])[0] ?? null;

    return suggestCategory(itemName, {
      exactItemMerchant: exactRes.data as PatternAggregate | null,
      byItem: topAggregate((byItemRes.data ?? []) as PatternAggregate[]) ? [topAggregate((byItemRes.data ?? []) as PatternAggregate[])!] : [],
      byMerchant: topAggregate((byMerchantRes.data ?? []) as PatternAggregate[]) ? [topAggregate((byMerchantRes.data ?? []) as PatternAggregate[])!] : [],
      categoryTree: categoriesRes.data.tree,
      mostUsedOverall: overallTop ? { category_id: overallTop.category_id, subcategory_id: null, usage_count: overallTop.txn_count } : null,
    });
  });

  return result;
}

/**
 * Recurring-expense candidates (spec section 11): items purchased on a
 * consistent cadence, surfaced as a dismiss-able suggestion — never
 * auto-created (spec section 88: "do NOT automatically invent transactions
 * from recurring patterns").
 */
export async function getRecurringCandidates() {
  return runAction(async (): Promise<RecurringCandidate[]> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data, error } = await supabase.rpc("get_item_gap_consistency", { p_household_id: householdId });
    if (error) throw new ActionError(error.message);

    const { data: existingRecurring } = await supabase
      .from("recurring_expenses")
      .select("name")
      .eq("household_id", householdId)
      .eq("active", true);
    const alreadyRecurring = new Set((existingRecurring ?? []).map((r) => r.name.toLowerCase()));

    return detectRecurringCandidates(data ?? [], alreadyRecurring);
  });
}

export async function createRecurringExpenseFromCandidate(candidate: {
  itemName: string;
  amount: number;
  categoryId: string;
  merchantId: string | null;
  frequency: Tables<"recurring_expenses">["frequency"];
}) {
  return runAction(async () => {
    const { supabase, householdId, userId } = await requireHouseholdContext();

    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        household_id: householdId,
        created_by: userId,
        name: candidate.itemName,
        amount: candidate.amount,
        category_id: candidate.categoryId,
        merchant_id: candidate.merchantId,
        frequency: candidate.frequency,
        active: true,
      })
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't set up the recurring expense");
    return data as Tables<"recurring_expenses">;
  });
}
