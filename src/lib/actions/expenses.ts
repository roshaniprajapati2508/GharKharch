"use server";

import { revalidatePath } from "next/cache";
import { expenseFormSchema, type ExpenseFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getTodayISO, getCurrentKolkataTime } from "@/lib/date-utils";
import type { Tables } from "@/types/database";

function normalizeItemName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Keeps `expense_patterns` up to date after every create/duplicate so the
 * Quick Add / suggestion engine (lib/expense-intelligence, a later phase) has
 * real usage data to learn from (spec section 18-19).
 */
async function upsertExpensePattern(
  supabase: Awaited<ReturnType<typeof requireHouseholdContext>>["supabase"],
  householdId: string,
  userId: string,
  input: { item_name: string; merchant_id: string | null | undefined; category_id: string; subcategory_id: string | null | undefined; amount: number }
) {
  const itemName = normalizeItemName(input.item_name);

  let query = supabase
    .from("expense_patterns")
    .select("id, usage_count, average_amount, amount_min, amount_max, frequency_score")
    .eq("household_id", householdId)
    .eq("item_name", itemName);

  query = input.merchant_id ? query.eq("merchant_id", input.merchant_id) : query.is("merchant_id", null);

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const prevAvg = existing.average_amount ? parseFloat(existing.average_amount) : input.amount;
    const usageCount = existing.usage_count + 1;
    const newAvg = (prevAvg * existing.usage_count + input.amount) / usageCount;
    const min = existing.amount_min ? Math.min(parseFloat(existing.amount_min), input.amount) : input.amount;
    const max = existing.amount_max ? Math.max(parseFloat(existing.amount_max), input.amount) : input.amount;

    await supabase
      .from("expense_patterns")
      .update({
        usage_count: usageCount,
        last_used_at: new Date().toISOString(),
        average_amount: newAvg.toFixed(2),
        amount_min: min.toFixed(2),
        amount_max: max.toFixed(2),
        frequency_score: existing.frequency_score * 0.7 + 1,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("expense_patterns").insert({
      household_id: householdId,
      user_id: userId,
      merchant_id: input.merchant_id ?? null,
      item_name: itemName,
      category_id: input.category_id,
      subcategory_id: input.subcategory_id ?? null,
      frequency_score: 1,
      last_used_at: new Date().toISOString(),
      usage_count: 1,
      average_amount: input.amount.toFixed(2),
      amount_min: input.amount.toFixed(2),
      amount_max: input.amount.toFixed(2),
    });
  }
}

function revalidateExpensePages() {
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/analytics");
  revalidatePath("/reports");
}

export async function createExpense(rawInput: ExpenseFormInput) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const input = expenseFormSchema.parse(rawInput);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by: userId,
        paid_by: input.paid_by,
        expense_type: input.expense_type,
        amount: input.amount,
        merchant_id: input.merchant_id ?? null,
        item_name: input.item_name,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
        payment_method: input.payment_method ?? null,
        card_id: input.card_id ?? null,
        upi_profile_id: input.upi_profile_id ?? null,
        bank_account_id: input.bank_account_id ?? null,
        expense_date: input.expense_date,
        expense_time: input.expense_time ?? `${getCurrentKolkataTime()}:00`,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't save the expense");

    await upsertExpensePattern(supabase, householdId, userId, {
      item_name: input.item_name,
      merchant_id: input.merchant_id,
      category_id: input.category_id,
      subcategory_id: input.subcategory_id,
      amount: input.amount,
    });

    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function updateExpense(id: string, rawInput: ExpenseFormInput) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const input = expenseFormSchema.parse(rawInput);

    const { data, error } = await supabase
      .from("expenses")
      .update({
        paid_by: input.paid_by,
        expense_type: input.expense_type,
        amount: input.amount,
        merchant_id: input.merchant_id ?? null,
        item_name: input.item_name,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
        payment_method: input.payment_method ?? null,
        card_id: input.card_id ?? null,
        upi_profile_id: input.upi_profile_id ?? null,
        bank_account_id: input.bank_account_id ?? null,
        expense_date: input.expense_date,
        expense_time: input.expense_time ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the expense");

    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function updateExpenseNotes(id: string, notes: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("expenses")
      .update({ notes: notes.trim() || null })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't save the note");
    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function softDeleteExpense(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't delete the expense");
    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function restoreExpense(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("expenses")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't restore the expense");
    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function duplicateExpense(id: string) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();

    const { data: original, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (fetchError || !original) throw new ActionError("Couldn't find the original expense");

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by: userId,
        paid_by: original.paid_by,
        expense_type: original.expense_type,
        amount: original.amount,
        merchant_id: original.merchant_id,
        item_name: original.item_name,
        category_id: original.category_id,
        subcategory_id: original.subcategory_id,
        payment_method: original.payment_method,
        card_id: original.card_id,
        upi_profile_id: original.upi_profile_id,
        bank_account_id: original.bank_account_id,
        expense_date: getTodayISO(), // spec section 43: duplicate always lands on today
        expense_time: `${getCurrentKolkataTime()}:00`,
        notes: original.notes,
      })
      .select()
      .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't duplicate the expense");

    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export interface ExpenseFilters {
  start?: string;
  end?: string;
  categoryIds?: string[];
  paidBy?: string | "all";
  merchantId?: string;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: "newest" | "oldest" | "highest" | "lowest";
  limit?: number;
}

/** Enriched shape the UI actually renders - joined in JS, never via PostgREST embeds (see database.ts header). */
export type EnrichedExpense = Tables<"expenses"> & {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  subcategory_name: string | null;
  merchant_name: string | null;
  payer_name: string;
};

export async function getExpenses(filters: ExpenseFilters = {}) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    let query = supabase.from("expenses").select("*").eq("household_id", householdId).is("deleted_at", null);

    if (filters.start) query = query.gte("expense_date", filters.start);
    if (filters.end) query = query.lte("expense_date", filters.end);
    if (filters.categoryIds?.length) query = query.in("category_id", filters.categoryIds);
    if (filters.paidBy && filters.paidBy !== "all") query = query.eq("paid_by", filters.paidBy);
    if (filters.merchantId) query = query.eq("merchant_id", filters.merchantId);
    if (filters.paymentMethod) query = query.eq("payment_method", filters.paymentMethod);
    if (typeof filters.minAmount === "number") query = query.gte("amount", filters.minAmount);
    if (typeof filters.maxAmount === "number") query = query.lte("amount", filters.maxAmount);

    switch (filters.sort) {
      case "oldest":
        query = query.order("expense_date", { ascending: true }).order("created_at", { ascending: true });
        break;
      case "highest":
        query = query.order("amount", { ascending: false });
        break;
      case "lowest":
        query = query.order("amount", { ascending: true });
        break;
      default:
        query = query.order("expense_date", { ascending: false }).order("created_at", { ascending: false });
    }

    query = query.limit(filters.limit ?? 30);

    const { data: expenses, error } = await query;
    if (error) throw new ActionError(error.message);

    const [{ data: categories }, { data: merchants }, { data: members }, { data: profiles }] = await Promise.all([
      supabase.from("categories").select("id, name, icon, color"),
      supabase.from("merchants").select("id, name"),
      supabase.from("household_members").select("user_id").eq("household_id", householdId),
      supabase.from("profiles").select("id, display_name"),
    ]);

    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
    const merchantMap = new Map((merchants ?? []).map((m) => [m.id, m.name]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    void members;

    const enriched: EnrichedExpense[] = (expenses ?? []).map((e) => {
      const cat = categoryMap.get(e.category_id);
      const subcat = e.subcategory_id ? categoryMap.get(e.subcategory_id) : null;
      return {
        ...e,
        category_name: cat?.name ?? null,
        category_icon: cat?.icon ?? null,
        category_color: cat?.color ?? null,
        subcategory_name: subcat?.name ?? null,
        merchant_name: e.merchant_id ? merchantMap.get(e.merchant_id) ?? null : null,
        payer_name: profileMap.get(e.paid_by) ?? "Someone",
      };
    });

    return enriched;
  });
}
