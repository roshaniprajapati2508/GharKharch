"use server";

import { revalidatePath } from "next/cache";
import { categoryFormSchema, type CategoryFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

export type CategoryWithChildren = Tables<"categories"> & { children: Tables<"categories">[] };

/** Global (household_id null) + this household's own categories, as a parent->children tree, plus the flat list. Excludes any global defaults this household has hidden/customized away (migration 014). */
export async function listCategoriesForHousehold(options?: { includeInactive?: boolean }) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: hiddenRows } = await supabase.from("household_hidden_categories").select("category_id").eq("household_id", householdId);
    const hiddenIds = new Set((hiddenRows ?? []).map((r) => r.category_id));

    let query = supabase
      .from("categories")
      .select("*")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("sort_order", { ascending: true });
    if (!options?.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;

    if (error) throw new ActionError(error.message);
    const flat = (data ?? []).filter((c) => !hiddenIds.has(c.id));

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

/**
 * "Edit" for a global default category (migration 014): can't mutate the
 * shared row (it's visible to every household), so this creates a normal
 * household-owned copy seeded from the default's current values plus
 * whatever the caller is changing, and hides the original default for this
 * household only. The new row is then just an ordinary category — full
 * edit/delete/reorder applies to it going forward.
 */
export async function customizeCategory(globalId: string, changes: Partial<Pick<CategoryFormInput, "name" | "icon" | "color">>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("customize_category", {
      p_global_id: globalId,
      p_household_id: householdId,
      p_name: changes.name ?? null,
      p_icon: changes.icon ?? null,
      p_color: changes.color ?? null,
    });
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't customize this category");
    revalidatePath("/more/categories");
    return data as Tables<"categories">;
  });
}

/** "Remove" for a global default category — hides it from this household's lists/pickers without touching the shared row or any other household (migration 014). */
export async function hideGlobalCategory(globalId: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.rpc("hide_global_category", { p_category_id: globalId, p_household_id: householdId });
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/categories");
    return { id: globalId };
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
