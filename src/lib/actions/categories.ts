"use server";

import { revalidatePath } from "next/cache";
import { categoryFormSchema, type CategoryFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

export type CategoryWithChildren = Tables<"categories"> & { children: Tables<"categories">[] };

/** Global (household_id null) + this household's own categories, as a parent->children tree, plus the flat list. */
export async function listCategoriesForHousehold(options?: { includeInactive?: boolean }) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    let query = supabase
      .from("categories")
      .select("*")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("sort_order", { ascending: true });
    if (!options?.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;

    if (error) throw new ActionError(error.message);
    const flat = data ?? [];

    const topLevel = flat.filter((c) => c.parent_id === null);
    const tree: CategoryWithChildren[] = topLevel.map((parent) => ({
      ...parent,
      children: flat.filter((c) => c.parent_id === parent.id),
    }));

    return { tree, flat };
  });
}

export async function createCategory(rawInput: CategoryFormInput) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const input = categoryFormSchema.parse(rawInput);

    const { data, error } = await supabase
      .from("categories")
      .insert({ household_id: householdId, ...input })
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't create the category");
    revalidatePath("/more/categories");
    return data as Tables<"categories">;
  });
}

export async function updateCategory(id: string, rawInput: Partial<CategoryFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: existing } = await supabase.from("categories").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only categories you've added can be edited");
    }

    const { data, error } = await supabase.from("categories").update(rawInput).eq("id", id).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the category");
    revalidatePath("/more/categories");
    return data as Tables<"categories">;
  });
}

export async function deleteCategory(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: existing } = await supabase.from("categories").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only categories you've added can be deleted");
    }

    const { count } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .is("deleted_at", null);
    if (count && count > 0) {
      throw new ActionError(`${count} expense(s) still use this category — move or delete them first`);
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/categories");
    return { id };
  });
}

/** Usage count (spec item 24 "safe delete"): how many non-deleted expenses reference this category directly. */
export async function getCategoryUsageCount(id: string) {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    const { count, error } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .is("deleted_at", null);
    if (error) throw new ActionError(error.message);
    return { count: count ?? 0 };
  });
}

/**
 * Safe delete: reassigns every reference (expenses, recurring templates,
 * budgets, patterns, and any child categories) to `targetId` before removing
 * `id`, so a household member can never accidentally corrupt historical
 * expense records by deleting a category that's still in use.
 */
export async function reassignAndDeleteCategory(id: string, targetId: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    if (id === targetId) throw new ActionError("Pick a different category to move things to");

    const { data: existing } = await supabase.from("categories").select("household_id, parent_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only categories you've added can be deleted");
    }

    const { data: target } = await supabase.from("categories").select("id").eq("id", targetId).maybeSingle();
    if (!target) throw new ActionError("That category no longer exists");

    await supabase.from("categories").update({ parent_id: targetId }).eq("parent_id", id);
    await supabase.from("expenses").update({ category_id: targetId }).eq("category_id", id);
    await supabase.from("expenses").update({ subcategory_id: targetId }).eq("subcategory_id", id);
    await supabase.from("recurring_expenses").update({ category_id: targetId }).eq("category_id", id);
    await supabase.from("budgets").update({ category_id: targetId }).eq("category_id", id);
    await supabase.from("expense_patterns").update({ category_id: targetId }).eq("category_id", id);
    await supabase.from("expense_patterns").update({ subcategory_id: targetId }).eq("subcategory_id", id);
    await supabase.from("merchants").update({ category_id: targetId }).eq("category_id", id);
    await supabase.from("merchants").update({ subcategory_id: targetId }).eq("subcategory_id", id);

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new ActionError(error.message);

    revalidatePath("/more/categories");
    return { id, targetId };
  });
}

/** Soft-delete (spec item 24): hide a household category from pickers without touching historical expenses. */
export async function setCategoryActive(id: string, isActive: boolean) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing } = await supabase.from("categories").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only categories you've added can be deactivated");
    }
    const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/categories");
    return { id, isActive };
  });
}

/** Bulk deactivate (spec item 24: bulk action bar). Skips any id the caller doesn't own rather than failing the whole batch. */
export async function bulkDeactivateCategories(ids: string[]) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: owned } = await supabase.from("categories").select("id").eq("household_id", householdId).in("id", ids);
    const ownedIds = (owned ?? []).map((c) => c.id);
    if (ownedIds.length === 0) return { deactivated: 0 };
    const { error } = await supabase.from("categories").update({ is_active: false }).in("id", ownedIds);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/categories");
    return { deactivated: ownedIds.length };
  });
}

/** Bulk hard-delete: only ever applied to categories with zero expense references (checked per-id, all-or-nothing per row). */
export async function bulkDeleteCategories(ids: string[]) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: owned } = await supabase.from("categories").select("id").eq("household_id", householdId).in("id", ids);
    const ownedIds = (owned ?? []).map((c) => c.id);
    let deleted = 0;
    let skipped = 0;
    for (const catId of ownedIds) {
      const { count } = await supabase.from("expenses").select("id", { count: "exact", head: true }).eq("category_id", catId).is("deleted_at", null);
      if (count && count > 0) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from("categories").delete().eq("id", catId);
      if (!error) deleted += 1;
    }
    revalidatePath("/more/categories");
    return { deleted, skipped };
  });
}

/** Manual reorder (spec item 24: drag/reorder within a sibling group) — writes sort_order 0..n for the given ordered id list. */
export async function reorderCategories(orderedIds: string[]) {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    await Promise.all(orderedIds.map((id, index) => supabase.from("categories").update({ sort_order: index }).eq("id", id)));
    revalidatePath("/more/categories");
    return { reordered: orderedIds.length };
  });
}
