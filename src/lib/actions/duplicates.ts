"use server";

// Server-action layer for migration 011's dedup tooling (spec items 37-46,
// 79-80). The one-time global-category cleanup already happened in the SQL
// migration itself; this file backs the interactive "Find duplicates" tool
// for a household's *own* categories/merchants - the ones a bug can't fix
// for them, because the user genuinely created two similar entries
// (e.g. "Zudio" / "Zudio Store").

import { revalidatePath } from "next/cache";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";

export interface DuplicateGroup {
  nameKey: string;
  ids: string[];
  names: string[];
  householdScoped: boolean;
  /** Parallel to `ids`: which entries are global/system defaults that can never be the side a merge deletes (migration 013). */
  isGlobal: boolean[];
}

export async function findDuplicateCategories() {
  return runAction(async (): Promise<DuplicateGroup[]> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("find_duplicate_categories", { p_household_id: householdId });
    if (error) throw new ActionError(error.message);
    return (data ?? []).map((row) => ({
      nameKey: row.name_key,
      ids: row.category_ids,
      names: row.category_names,
      householdScoped: row.household_scoped,
      isGlobal: row.is_global ?? row.category_ids.map(() => false),
    }));
  });
}

export async function findDuplicateMerchants() {
  return runAction(async (): Promise<DuplicateGroup[]> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("find_duplicate_merchants", { p_household_id: householdId });
    if (error) throw new ActionError(error.message);
    return (data ?? []).map((row) => ({
      nameKey: row.name_key,
      ids: row.merchant_ids,
      names: row.merchant_names,
      householdScoped: row.household_scoped,
      isGlobal: row.is_global ?? row.merchant_ids.map(() => false),
    }));
  });
}

export interface MergeImpact {
  expenseCount: number;
  otherCount: number;
}

export async function getCategoryMergeImpact(duplicateId: string) {
  return runAction(async (): Promise<MergeImpact> => {
    const { supabase } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_category_merge_impact", { p_duplicate_id: duplicateId });
    if (error) throw new ActionError(error.message);
    return { expenseCount: data?.expense_count ?? 0, otherCount: (data?.merchant_count ?? 0) + (data?.child_category_count ?? 0) };
  });
}

export async function getMerchantMergeImpact(duplicateId: string) {
  return runAction(async (): Promise<MergeImpact> => {
    const { supabase } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_merchant_merge_impact", { p_duplicate_id: duplicateId });
    if (error) throw new ActionError(error.message);
    return { expenseCount: data?.expense_count ?? 0, otherCount: data?.child_merchant_count ?? 0 };
  });
}

export async function mergeCategories(canonicalId: string, duplicateId: string) {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("merge_categories", { p_canonical_id: canonicalId, p_duplicate_id: duplicateId });
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/categories");
    return { expensesReassigned: data?.expenses_reassigned ?? 0 };
  });
}

export async function mergeMerchants(canonicalId: string, duplicateId: string) {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("merge_merchants", { p_canonical_id: canonicalId, p_duplicate_id: duplicateId });
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/merchants");
    return { expensesReassigned: data?.expenses_reassigned ?? 0 };
  });
}
