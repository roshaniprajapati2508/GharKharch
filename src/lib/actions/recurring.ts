"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { createExpense } from "@/lib/actions/expenses";
import { expenseFormSchema } from "@/lib/validations/expense";
import { getTodayISO, addDaysISO, parseISODate } from "@/lib/date-utils";
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

// Normalizes each frequency to an equivalent monthly amount, for a single
// "total monthly recurring spend" figure (wishlist gap). Values follow the
// actual `RecurringFrequency` enum in types/database.ts — there is no
// biweekly/quarterly cadence in this schema, so those aren't handled.
// "custom" has no fixed cadence to normalize, so it's excluded from the
// monthly total (its amount is still shown per-rule in the Upcoming list).
const MONTHLY_MULTIPLIER: Record<Tables<"recurring_expenses">["frequency"], number | null> = {
  daily: 30.44, // average days per month
  weekly: 4.345, // average weeks per month
  monthly: 1,
  yearly: 1 / 12,
  custom: null,
};

export interface RecurringSummary {
  monthlyTotal: number;
  upcoming: RecurringWithCategory[];
}

/** Monthly-normalized total across active rules, plus the active rules sorted soonest-due-first (spec wishlist gap: "upcoming bills"). */
export async function getRecurringSummary() {
  return runAction(async (): Promise<RecurringSummary> => {
    const listResult = await listRecurringExpenses();
    if (listResult.error !== null) throw new ActionError(listResult.error);

    const active = listResult.data.filter((r) => r.active);
    const monthlyTotal = active.reduce((sum, r) => {
      const multiplier = MONTHLY_MULTIPLIER[r.frequency];
      return multiplier === null ? sum : sum + Number(r.amount) * multiplier;
    }, 0);

    const upcoming = [...active].sort((a, b) => {
      if (!a.next_due_date && !b.next_due_date) return 0;
      if (!a.next_due_date) return 1;
      if (!b.next_due_date) return -1;
      return a.next_due_date.localeCompare(b.next_due_date);
    });

    return { monthlyTotal, upcoming };
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

/**
 * Advances a rule's next_due_date by one cycle of its frequency. "custom" has
 * no fixed interval to advance by — the date is left unchanged, and the user
 * updates it manually next time they know when the next one is (mirrors how
 * MONTHLY_MULTIPLIER above excludes "custom" from the normalized total for
 * the same reason). A null next_due_date (never set) stays null.
 */
function advanceNextDueDate(current: string | null, frequency: Tables<"recurring_expenses">["frequency"]): string | null {
  if (!current) return current;
  if (frequency === "custom") return current;
  if (frequency === "daily") return addDaysISO(current, 1);
  if (frequency === "weekly") return addDaysISO(current, 7);

  const d = parseISODate(current);
  if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Logs one real occurrence of a recurring bill as an actual expense, tagged
 * with `recurring_rule_id`, then advances the rule's `next_due_date` forward
 * by one cycle. This is the ONLY place an expense is ever created from a
 * recurring rule, and it only ever runs from a direct, explicit user tap
 * ("Log this bill" in more/recurring/page.tsx) — never automatically, never
 * on a timer (spec: "never silently create an expense"). The caller must
 * supply the amount (and any other details) themselves rather than this
 * function defaulting to the rule's stored amount, since real bill amounts
 * drift and the person should always get a chance to review/adjust before
 * it's saved.
 */
export async function logRecurringOccurrence(
  recurringId: string,
  expenseInput: {
    amount: number;
    paid_by: string;
    expense_type: Tables<"expenses">["expense_type"];
    expense_date?: string;
    payment_method?: string | null;
    card_id?: string | null;
    upi_profile_id?: string | null;
    bank_account_id?: string | null;
    notes?: string | null;
  }
) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: rule, error: fetchError } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("id", recurringId)
      .eq("household_id", householdId)
      .single();
    if (fetchError || !rule) throw new ActionError("Couldn't find that recurring expense");
    if (!rule.active) throw new ActionError("This recurring expense is paused — resume it first");

    const payload = expenseFormSchema.parse({
      amount: expenseInput.amount,
      item_name: rule.name,
      category_id: rule.category_id,
      subcategory_id: null,
      merchant_id: rule.merchant_id,
      paid_by: expenseInput.paid_by,
      expense_type: expenseInput.expense_type,
      payment_method: expenseInput.payment_method ?? null,
      card_id: expenseInput.card_id ?? null,
      upi_profile_id: expenseInput.upi_profile_id ?? null,
      bank_account_id: expenseInput.bank_account_id ?? null,
      expense_date: expenseInput.expense_date ?? getTodayISO(),
      notes: expenseInput.notes ?? null,
    });

    const created = await createExpense(payload, recurringId);
    if (created.error !== null) throw new ActionError(created.error);

    const nextDueDate = advanceNextDueDate(rule.next_due_date, rule.frequency);
    if (nextDueDate !== rule.next_due_date) {
      const { error: advanceError } = await supabase
        .from("recurring_expenses")
        .update({ next_due_date: nextDueDate })
        .eq("id", recurringId)
        .eq("household_id", householdId);
      if (advanceError) throw new ActionError(advanceError.message);
    }

    revalidatePath("/more/recurring");
    return created.data;
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
