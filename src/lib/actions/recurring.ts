"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

// `recurring_expenses` (migration 001) has had a real, RLS-protected table
// since day one, but the only thing that ever wrote to it was accepting a
// detected "looks recurring" suggestion (intelligence.ts) — there was no way
// to see, edit, pause, or manually add a recurring bill (rent, a
// subscription, an EMI) that GharKharch hadn't already detected on its own.
// This file + more/recurring/page.tsx close that gap. Nothing here ever
// auto-creates an actual expense from a rule (spec section 88) — it's purely
// bookkeeping of what recurs, same as the existing suggestion-acceptance flow.

const recurringInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  amount: z.number().positive("Enter an amount greater than 0"),
  category_id: z.string().uuid("Choose a category"),
  merchant_id: z.string().uuid().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
  next_due_date: z.string().nullable(),
});

export type RecurringWithCategory = Tables<"recurring_expenses"> & {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  merchant_name: string | null;
};

export async function listRecurringExpenses() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: rules, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("household_id", householdId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new ActionError(error.message);

    const [{ data: categories }, { data: merchants }] = await Promise.all([
      supabase.from("categories").select("id, name, icon, color"),
      supabase.from("merchants").select("id, name"),
    ]);
    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
    const merchantMap = new Map((merchants ?? []).map((m) => [m.id, m.name]));

    const enriched: RecurringWithCategory[] = (rules ?? []).map((r) => {
      const cat = categoryMap.get(r.category_id);
      return {
        ...r,
        category_name: cat?.name ?? null,
        category_icon: cat?.icon ?? null,
        category_color: cat?.color ?? null,
        merchant_name: r.merchant_id ? merchantMap.get(r.merchant_id) ?? null : null,
      };
    });

    return enriched;
  });
}

export async function createRecurringExpense(input: {
  name: string;
  amount: number;
  category_id: string;
  merchant_id: string | null;
  frequency: Tables<"recurring_expenses">["frequency"];
  next_due_date: string | null;
}) {
  return runAction(async () => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    const parsed = recurringInputSchema.parse(input);

    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        household_id: householdId,
        created_by: userId,
        name: parsed.name,
        amount: parsed.amount,
        category_id: parsed.category_id,
        merchant_id: parsed.merchant_id,
        frequency: parsed.frequency,
        next_due_date: parsed.next_due_date,
        active: true,
      })
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't add that recurring expense");
    revalidatePath("/more/recurring");
    return data as Tables<"recurring_expenses">;
  });
}

export async function updateRecurringExpense(
  id: string,
  input: {
    name: string;
    amount: number;
    category_id: string;
    merchant_id: string | null;
    frequency: Tables<"recurring_expenses">["frequency"];
    next_due_date: string | null;
  }
) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const parsed = recurringInputSchema.parse(input);

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({
        name: parsed.name,
        amount: parsed.amount,
        category_id: parsed.category_id,
        merchant_id: parsed.merchant_id,
        frequency: parsed.frequency,
        next_due_date: parsed.next_due_date,
      })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update that recurring expense");
    revalidatePath("/more/recurring");
    return data as Tables<"recurring_expenses">;
  });
}

export async function setRecurringActive(id: string, active: boolean) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({ active })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update that recurring expense");
    revalidatePath("/more/recurring");
    return data as Tables<"recurring_expenses">;
  });
}

export async function deleteRecurringExpense(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    // Safe to hard-delete (unlike categories/merchants): expenses.recurring_rule_id
    // is ON DELETE SET NULL (migration 001), so past logged expenses that were
    // tagged from this rule simply lose the tag — their amount/category/date
    // are untouched.
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id).eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/recurring");
    return { deleted: true };
  });
}
