"use server";

import { revalidatePath } from "next/cache";
import { expenseFormSchema, type ExpenseFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { logActivityEvent } from "@/lib/actions/activity-events";
import { getTodayISO } from "@/lib/date-utils";
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

/**
 * `recurringRuleId` is an internal-only parameter (not part of the public
 * expense form) — set exclusively by `logRecurringOccurrence` in
 * recurring.ts when the user explicitly taps "Log this bill" on a recurring
 * rule. It is never inferred or set automatically for a normal Add Expense
 * submission (spec: "never silently create an expense" applies here too —
 * the *tagging* as recurring must trace back to that one explicit action).
 */
/**
 * `receiptPath` is an internal-only third parameter, additive on top of the
 * existing (rawInput, recurringRuleId) signature so every existing caller
 * keeps working unchanged. It is set only when the person actually attached
 * or scanned a receipt image (add-expense-sheet.tsx) — the file itself is
 * always uploaded client-side first (to the private `receipts` bucket, see
 * migration 017), and only the resulting storage *path* is ever passed here.
 */
export async function createExpense(rawInput: ExpenseFormInput, recurringRuleId?: string, receiptPath?: string | null) {
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
        entry_type: input.entry_type,
        amount: input.amount,
        merchant_id: input.merchant_id ?? null,
        item_name: input.item_name,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
        payment_method: input.payment_method ?? null,
        card_id: input.card_id ?? null,
        upi_profile_id: input.upi_profile_id ?? null,
        bank_account_id: input.bank_account_id ?? null,
        recurring_rule_id: recurringRuleId ?? null,
        receipt_path: receiptPath ?? null,
        expense_date: input.expense_date,
        expense_time: input.expense_time ?? null,
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

    try {
      await logActivityEvent(supabase, {
        householdId,
        actorId: userId,
        eventType: input.entry_type === "income" ? "income_created" : "expense_created",
        entityType: "expense",
        entityId: data.id,
        summary: `${input.entry_type === "income" ? "Logged income" : "Added expense"}: ${input.item_name} (${input.amount})`,
      });
    } catch {
      // Activity logging must never fail the actual save.
    }

    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

export async function updateExpense(id: string, rawInput: ExpenseFormInput) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const input = expenseFormSchema.parse(rawInput);

    const { data, error } = await supabase
      .from("expenses")
      .update({
        paid_by: input.paid_by,
        expense_type: input.expense_type,
        entry_type: input.entry_type,
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

    try {
      await logActivityEvent(supabase, {
        householdId,
        actorId: userId,
        eventType: "expense_updated",
        entityType: "expense",
        entityId: data.id,
        summary: `Edited: ${input.item_name} (${input.amount})`,
      });
    } catch {
      // Activity logging must never fail the actual save.
    }

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

/**
 * Patches a single field on one expense (spec: Pillar 4, inline
 * double-click-to-edit on the Expenses table). Deliberately separate from
 * updateExpense() - that one requires the full ExpenseFormInput because the
 * Add Expense sheet always has the whole form in hand; an inline edit only
 * ever touches the one cell the person clicked, so re-validating/round-
 * tripping the entire expense for a single-field patch would be both more
 * code and a bigger blast radius if something else on the row is stale.
 */
export async function updateExpenseField(id: string, field: "amount" | "item_name", value: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    let patch: { amount: number } | { item_name: string };
    if (field === "amount") {
      const amount = parseFloat(value);
      if (!Number.isFinite(amount) || amount <= 0) throw new ActionError("Enter a valid amount");
      patch = { amount };
    } else {
      const item_name = value.trim();
      if (!item_name) throw new ActionError("Item name can't be empty");
      patch = { item_name };
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the expense");
    revalidateExpensePages();
    return data as Tables<"expenses">;
  });
}

/**
 * Applies the same category and/or payment-method change to several expenses
 * at once (spec: Pillar 4, bulk actions on the Expenses table's multi-select
 * bar). Both fields are optional so the caller only sends what the person
 * actually changed. `subcategory_id` is always cleared alongside a bulk
 * category change - a subcategory of the OLD category would be meaningless
 * once the parent category changes, and there's no per-row subcategory
 * picker in the bulk bar to choose a new one.
 */
export async function bulkUpdateExpenses(
  ids: string[],
  patch: { category_id?: string; subcategory_id?: string | null; payment_method?: string }
) {
  return runAction(async () => {
    if (ids.length === 0) throw new ActionError("No expenses selected");
    const { supabase, householdId } = await requireHouseholdContext();

    const updatePayload: { category_id?: string; subcategory_id?: string | null; payment_method?: string } = {};
    if (patch.category_id) {
      updatePayload.category_id = patch.category_id;
      updatePayload.subcategory_id = patch.subcategory_id ?? null;
    }
    if (patch.payment_method) updatePayload.payment_method = patch.payment_method;
    if (Object.keys(updatePayload).length === 0) throw new ActionError("Nothing to update");

    const { error } = await supabase
      .from("expenses")
      .update(updatePayload)
      .in("id", ids)
      .eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidateExpensePages();
    return { count: ids.length };
  });
}

/** Soft-deletes several expenses at once (spec: Pillar 4 bulk actions). Same soft-delete-only rule as softDeleteExpense - never a hard delete. */
export async function bulkSoftDeleteExpenses(ids: string[]) {
  return runAction(async () => {
    if (ids.length === 0) throw new ActionError("No expenses selected");
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids)
      .eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidateExpensePages();
    return { count: ids.length };
  });
}

/** Restores several soft-deleted expenses at once - powers the bulk-delete undo toast. */
export async function bulkRestoreExpenses(ids: string[]) {
  return runAction(async () => {
    if (ids.length === 0) return { count: 0 };
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase
      .from("expenses")
      .update({ deleted_at: null })
      .in("id", ids)
      .eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidateExpensePages();
    return { count: ids.length };
  });
}

export async function softDeleteExpense(id: string) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't delete the expense");
    try {
      await logActivityEvent(supabase, {
        householdId,
        actorId: userId,
        eventType: "expense_deleted",
        entityType: "expense",
        entityId: data.id,
        summary: `Deleted: ${data.item_name} (${data.amount})`,
      });
    } catch {
      // Activity logging must never fail the actual save.
    }
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
        entry_type: original.entry_type,
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
  merchantIds?: string[];
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: "newest" | "oldest" | "highest" | "lowest";
  limit?: number;
}

/** Enriched shape the UI actually renders — joined in JS, never via PostgREST embeds (see database.ts header). */
export type EnrichedExpense = Tables<"expenses"> & {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  subcategory_name: string | null;
  merchant_name: string | null;
  payer_name: string;
  /** Name of the recurring rule this expense was logged from (via `logRecurringOccurrence`), or null for a one-off expense. Powers the "Recurring" badge on expense rows. */
  recurring_rule_name: string | null;
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
    if (filters.merchantIds?.length) query = query.in("merchant_id", filters.merchantIds);
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

    const recurringRuleIds = Array.from(new Set((expenses ?? []).map((e) => e.recurring_rule_id).filter((id): id is string => !!id)));

    const [{ data: categories }, { data: merchants }, { data: members }, { data: profiles }, { data: recurringRules }] = await Promise.all([
      supabase.from("categories").select("id, name, icon, color"),
      supabase.from("merchants").select("id, name"),
      supabase.from("household_members").select("user_id").eq("household_id", householdId),
      supabase.from("profiles").select("id, display_name"),
      recurringRuleIds.length ? supabase.from("recurring_expenses").select("id, name").in("id", recurringRuleIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
    const merchantMap = new Map((merchants ?? []).map((m) => [m.id, m.name]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const recurringRuleMap = new Map((recurringRules ?? []).map((r) => [r.id, r.name]));
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
        recurring_rule_name: e.recurring_rule_id ? recurringRuleMap.get(e.recurring_rule_id) ?? null : null,
      };
    });

    return enriched;
  });
}

/**
 * Mints a short-lived signed URL for a receipt image (the `receipts` bucket
 * is private — migration 017 — so there is no public URL to just read off
 * the expense row). Re-checks the path's household prefix server-side before
 * calling Storage, on top of the bucket's own RLS, so a stale/tampered path
 * can never be used to probe another household's folder.
 */
export async function getReceiptSignedUrl(receiptPath: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    if (!receiptPath.startsWith(`${householdId}/`)) {
      throw new ActionError("Receipt not found");
    }
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(receiptPath, 300);
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't load the receipt");
    return data.signedUrl;
  });
}
