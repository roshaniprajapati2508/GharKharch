"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

const nameSchema = z.string().trim().min(1, "Enter a name").max(60);

/**
 * Renames the household. Restricted to the owner (the person who created it -
 * migration 001's `create_household()` - vs. a partner who joined via invite
 * code, who gets the 'member' role) by the RLS policy on `households` itself
 * (migration 002: "households: owner can update"), so this checks the role
 * first to give a clear error instead of a confusing silent no-op from RLS
 * quietly returning zero rows.
 */
export async function renameHousehold(name: string) {
  return runAction(async () => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    const parsed = nameSchema.parse(name);

    const { data: membership } = await supabase
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.role !== "owner") {
      throw new ActionError("Only the household owner can rename it");
    }

    const { data, error } = await supabase.from("households").update({ name: parsed }).eq("id", householdId).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't rename the household");

    revalidatePath("/", "layout");
    return data as Tables<"households">;
  });
}
