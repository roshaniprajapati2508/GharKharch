"use server";

import { revalidatePath } from "next/cache";
import { merchantFormSchema, type MerchantFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { normalizeMerchantName } from "@/lib/merchant-utils";
import type { Tables, TablesUpdate } from "@/types/database";

/** Global (system) + this household's own merchants. Excludes any global/system merchants this household has hidden/customized away (migration 014). */
export async function listMerchantsForHousehold() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: hiddenRows } = await supabase.from("household_hidden_merchants").select("merchant_id").eq("household_id", householdId);
    const hiddenIds = new Set((hiddenRows ?? []).map((r) => r.merchant_id));

    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new ActionError(error.message);
    return ((data ?? []) as Tables<"merchants">[]).filter((m) => !hiddenIds.has(m.id));
  });
}

export async function createMerchant(input: MerchantFormInput) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const parsed = merchantFormSchema.parse(input);
    const normalized = normalizeMerchantName(parsed.name);

    const { data, error } = await supabase
      .from("merchants")
      .insert({
        household_id: householdId,
        name: parsed.name,
        normalized_name: normalized,
        category_id: parsed.category_id ?? null,
        subcategory_id: parsed.subcategory_id ?? null,
        merchant_type: parsed.merchant_type,
        channel: parsed.channel,
        icon: parsed.icon ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new ActionError("You already have a merchant with that name");
      throw new ActionError(error.message);
    }
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

export async function updateMerchant(id: string, rawInput: Partial<MerchantFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: existing } = await supabase.from("merchants").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be edited");
    }

    const patch: TablesUpdate<"merchants"> = { ...rawInput };
    if (rawInput.name) patch.normalized_name = normalizeMerchantName(rawInput.name);

    const { data, error } = await supabase.from("merchants").update(patch).eq("id", id).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the merchant");
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

/**
 * "Edit" for a global/system merchant (migration 014): creates a household-
 * owned copy seeded from the merchant's current values plus any changes,
 * and hides the original for this household only. Mirrors customizeCategory.
 */
export async function customizeMerchant(globalId: string, changes: Partial<Pick<MerchantFormInput, "name" | "icon">>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("customize_merchant", {
      p_global_id: globalId,
      p_household_id: householdId,
      p_name: changes.name ?? null,
      p_icon: changes.icon ?? null,
    });
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't customize this merchant");
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

/** "Remove" for a global/system merchant - hides it from this household's lists/pickers without touching the shared row or any other household (migration 014). */
export async function hideGlobalMerchant(globalId: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.rpc("hide_global_merchant", { p_merchant_id: globalId, p_household_id: householdId });
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/merchants");
    return { id: globalId };
  });
}

export async function deactivateMerchant(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing } = await supabase.from("merchants").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be deactivated");
    }
    const { error } = await supabase.from("merchants").update({ is_active: false }).eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/merchants");
    return { id };
  });
}

/** Add one alias (e.g. "instamart" -> Swiggy Instamart) - spec item 44's merchant alias system. Case/whitespace-normalized, de-duplicated. */
export async function addMerchantAlias(id: string, alias: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const cleaned = alias.trim().toLowerCase();
    if (!cleaned) throw new ActionError("Enter an alias first");

    const { data: existing } = await supabase.from("merchants").select("household_id, aliases").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be edited");
    }
    const current = existing.aliases ?? [];
    if (current.includes(cleaned)) throw new ActionError("That alias is already added");

    const { data, error } = await supabase
      .from("merchants")
      .update({ aliases: [...current, cleaned] })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't add that alias");
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

export async function removeMerchantAlias(id: string, alias: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing } = await supabase.from("merchants").select("household_id, aliases").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be edited");
    }
    const next = (existing.aliases ?? []).filter((a) => a !== alias);
    const { data, error } = await supabase.from("merchants").update({ aliases: next }).eq("id", id).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't remove that alias");
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

/** Sets or clears which merchant this one rolls up under (e.g. "Swiggy Instamart" under "Swiggy") - spec item 44. */
export async function setMerchantParent(id: string, parentId: string | null) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    if (id === parentId) throw new ActionError("A merchant can't be its own parent");

    const { data: existing } = await supabase.from("merchants").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be edited");
    }
    if (parentId) {
      const { data: parent } = await supabase.from("merchants").select("id").eq("id", parentId).maybeSingle();
      if (!parent) throw new ActionError("That merchant no longer exists");
    }
    const { data, error } = await supabase.from("merchants").update({ parent_merchant_id: parentId }).eq("id", id).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the parent merchant");
    revalidatePath("/more/merchants");
    return data as Tables<"merchants">;
  });
}

export async function deleteMerchant(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing } = await supabase.from("merchants").select("household_id").eq("id", id).maybeSingle();
    if (!existing || existing.household_id !== householdId) {
      throw new ActionError("Only merchants you've added can be deleted");
    }
    const { count } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", id)
      .is("deleted_at", null);
    if (count && count > 0) {
      throw new ActionError(`${count} expense(s) still reference this merchant - deactivate it instead`);
    }
    const { error } = await supabase.from("merchants").delete().eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/merchants");
    return { id };
  });
}
