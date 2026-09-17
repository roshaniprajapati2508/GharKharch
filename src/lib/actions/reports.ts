"use server";

// Report generation (spec sections 31, 32, 62): reuses the same Phase 4
// aggregate functions as the Analytics screen — a report is just a curated,
// presentation-focused view over the same server-aggregated numbers.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getExpenses, createExpense as createExpenseAction, type EnrichedExpense } from "@/lib/actions/expenses";
import { getPreviousComparableRange, type DateRange } from "@/lib/date-utils";
import type { Database, Tables } from "@/types/database";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];
type TopExpenseRow = Database["public"]["Functions"]["get_top_expenses"]["Returns"][number];

const EMPTY_SUMMARY: ExpenseSummaryRow = {
  total: "0",
  txn_count: 0,
  avg_transaction: "0",
  days: 0,
  largest_amount: null,
  largest_expense_id: null,
};

export interface ReportData {
  range: DateRange;
  previousRange: DateRange;
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categoryBreakdown: CategoryBreakdownRow[];
  previousCategoryBreakdown: CategoryBreakdownRow[];
  personBreakdown: PersonBreakdownRow[];
  merchantBreakdown: MerchantBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
  dailySpending: DailySpendingRow[];
  topExpenses: TopExpenseRow[];
}

export async function getReportData(range: DateRange) {
  return runAction(async (): Promise<ReportData> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const previousRange = getPreviousComparableRange(range);

    const [summaryRes, prevSummaryRes, categoryRes, prevCategoryRes, personRes, merchantRes, itemRes, dailyRes, topRes] = await Promise.all([
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end }),
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end }),
      supabase.rpc("get_person_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_limit: 10 }),
      supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_limit: 10 }),
      supabase.rpc("get_daily_spending", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_top_expenses", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_limit: 10 }),
    ]);

    if (summaryRes.error) throw new ActionError(summaryRes.error.message);
    if (categoryRes.error) throw new ActionError(categoryRes.error.message);
    if (personRes.error) throw new ActionError(personRes.error.message);
    if (merchantRes.error) throw new ActionError(merchantRes.error.message);
    if (itemRes.error) throw new ActionError(itemRes.error.message);
    if (dailyRes.error) throw new ActionError(dailyRes.error.message);
    if (topRes.error) throw new ActionError(topRes.error.message);

    return {
      range,
      previousRange,
      summary: summaryRes.data?.[0] ?? EMPTY_SUMMARY,
      previousSummary: prevSummaryRes.data?.[0] ?? EMPTY_SUMMARY,
      categoryBreakdown: categoryRes.data ?? [],
      previousCategoryBreakdown: prevCategoryRes.data ?? [],
      personBreakdown: personRes.data ?? [],
      merchantBreakdown: merchantRes.data ?? [],
      itemAnalytics: itemRes.data ?? [],
      dailySpending: dailyRes.data ?? [],
      topExpenses: topRes.data ?? [],
    };
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds CSV text for every expense in `range` (spec section 31, 62). Kept server-side so the export always reflects RLS-scoped, server-truth data. */
export async function exportExpensesCsv(range: DateRange) {
  return runAction(async () => {
    const result = await getExpenses({ start: range.start, end: range.end, sort: "oldest", limit: 5000 });
    if (result.error !== null) throw new ActionError(result.error);

    const header = ["Date", "Time", "Item", "Merchant", "Category", "Subcategory", "Paid By", "Payment Method", "Amount", "Type", "Notes"];
    const rows = (result.data as EnrichedExpense[]).map((e) => [
      e.expense_date,
      e.expense_time ?? "",
      e.item_name,
      e.merchant_name ?? "",
      e.category_name ?? "",
      "",
      e.payer_name,
      e.payment_method ?? "",
      e.amount,
      e.expense_type,
      e.notes ?? "",
    ]);

    const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");
    return csv;
  });
}

/** Builds JSON text for every expense in `range` (spec section 31, 62), mirroring exportExpensesCsv's filtering/enrichment (category/subcategory/merchant names, not just ids) but as a JSON array. Kept server-side for the same server-truth/RLS reasons as the CSV export. */
export async function exportExpensesJson(range: DateRange) {
  return runAction(async () => {
    const result = await getExpenses({ start: range.start, end: range.end, sort: "oldest", limit: 5000 });
    if (result.error !== null) throw new ActionError(result.error);

    const rows = (result.data as EnrichedExpense[]).map((e) => ({
      date: e.expense_date,
      time: e.expense_time ?? null,
      item: e.item_name,
      merchant: e.merchant_name ?? null,
      category: e.category_name ?? null,
      subcategory: e.subcategory_name ?? null,
      paidBy: e.payer_name,
      paymentMethod: e.payment_method ?? null,
      amount: e.amount,
      type: e.expense_type,
      notes: e.notes ?? null,
    }));

    return JSON.stringify(rows, null, 2);
  });
}

// --- Full-data backup export (not scoped to a report's date range) ---------
// A JSON snapshot of everything this household owns, not just the expenses
// in a chosen period. Structured with an explicit `version` so a future
// import feature could plausibly restore from it, even though only CSV
// import (lib/actions/reports.ts#importExpensesFromCsv) exists today.
// Payment instruments are included in full — per the existing schema
// (user_cards/bank_accounts/upi_profiles), only identifiers like last4/
// nickname/label are ever stored, never a credential, so a full-row export
// carries nothing sensitive beyond what the household already sees on the
// Payment Methods screen.

const BACKUP_SCHEMA_VERSION = 1;

export interface HouseholdBackup {
  version: number;
  exportedAt: string;
  householdId: string;
  expenses: Tables<"expenses">[];
  categories: Tables<"categories">[];
  merchants: Tables<"merchants">[];
  budgets: Tables<"budgets">[];
  recurringExpenses: Tables<"recurring_expenses">[];
  paymentMethods: Tables<"payment_methods">[];
  userCards: Tables<"user_cards">[];
  upiProfiles: Tables<"upi_profiles">[];
  bankAccounts: Tables<"bank_accounts">[];
}

/** Full JSON snapshot of the household's own data (spec: "Backup my data" on the More/Data & Privacy screen) — every non-deleted expense (no date-range limit, unlike the CSV/JSON exports above) plus every reference table the household owns. */
export async function exportHouseholdBackup() {
  return runAction(async (): Promise<HouseholdBackup> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const [expensesRes, categoriesRes, merchantsRes, budgetsRes, recurringRes, paymentMethodsRes, userCardsRes, upiProfilesRes, bankAccountsRes] =
      await Promise.all([
        supabase.from("expenses").select("*").eq("household_id", householdId).is("deleted_at", null),
        supabase.from("categories").select("*").eq("household_id", householdId),
        supabase.from("merchants").select("*").eq("household_id", householdId),
        supabase.from("budgets").select("*").eq("household_id", householdId),
        supabase.from("recurring_expenses").select("*").eq("household_id", householdId),
        supabase.from("payment_methods").select("*").eq("household_id", householdId),
        supabase.from("user_cards").select("*").eq("household_id", householdId),
        supabase.from("upi_profiles").select("*").eq("household_id", householdId),
        supabase.from("bank_accounts").select("*").eq("household_id", householdId),
      ]);

    for (const res of [expensesRes, categoriesRes, merchantsRes, budgetsRes, recurringRes, paymentMethodsRes, userCardsRes, upiProfilesRes, bankAccountsRes]) {
      if (res.error) throw new ActionError(res.error.message);
    }

    return {
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      householdId,
      expenses: expensesRes.data ?? [],
      categories: categoriesRes.data ?? [],
      merchants: merchantsRes.data ?? [],
      budgets: budgetsRes.data ?? [],
      recurringExpenses: recurringRes.data ?? [],
      paymentMethods: paymentMethodsRes.data ?? [],
      userCards: userCardsRes.data ?? [],
      upiProfiles: upiProfilesRes.data ?? [],
      bankAccounts: bankAccountsRes.data ?? [],
    };
  });
}

// --- CSV import (lib/app/(app)/more/import/page.tsx, step 3) ---------------

export interface ValidatedImportRow {
  expense_date: string;
  item_name: string;
  amount: number;
  merchant_name: string | null;
  category_name: string | null;
  paid_by: string;
  payment_method: string | null;
  expense_type: Tables<"expenses">["expense_type"];
  notes: string | null;
}

export interface ImportResultRow {
  row: number;
  itemName: string;
  success: boolean;
  reason: string | null;
}

/**
 * Inserts previously-validated CSV rows one at a time via the existing
 * `createExpense` action (spec: reuse it, never a parallel insert path — that
 * keeps expense_patterns upsert, revalidation, and RLS-scoping all in the one
 * place they already live). Category/merchant name -> id resolution happens
 * here (case-insensitively, against the household's real categories/
 * merchants) since the client only ever sent names it matched during preview,
 * never ids it could have fabricated. Never a silent partial failure — every
 * row's outcome is reported back individually.
 */
export async function importExpensesFromCsv(rows: ValidatedImportRow[]) {
  return runAction(async (): Promise<{ succeeded: number; failed: number; results: ImportResultRow[] }> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    if (rows.length === 0) throw new ActionError("Nothing to import");
    if (rows.length > 2000) throw new ActionError("Import at most 2000 rows at a time");

    const [{ data: categories }, { data: merchants }] = await Promise.all([
      supabase.from("categories").select("id, name").or(`household_id.is.null,household_id.eq.${householdId}`),
      supabase.from("merchants").select("id, name").or(`household_id.is.null,household_id.eq.${householdId}`),
    ]);
    const categoryByLowerName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    const merchantByLowerName = new Map((merchants ?? []).map((m) => [m.name.toLowerCase(), m.id]));

    // Fallback category for rows whose category name didn't match anything
    // (never silently invent a category — but expenses.category_id is
    // NOT NULL, so an unmatched row needs *some* real category to land in).
    // Prefer a household category literally named "Uncategorized"/"Other" if
    // one exists; otherwise the first category available at all.
    const fallbackCategoryId =
      categoryByLowerName.get("uncategorized") ?? categoryByLowerName.get("other") ?? categories?.[0]?.id ?? null;
    if (!fallbackCategoryId) throw new ActionError("No categories exist yet — add a category before importing");

    const results: ImportResultRow[] = [];
    let succeeded = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const categoryId = (row.category_name && categoryByLowerName.get(row.category_name.toLowerCase())) || fallbackCategoryId;
        const merchantId = (row.merchant_name && merchantByLowerName.get(row.merchant_name.toLowerCase())) || null;

        const created = await createExpenseAction(
          {
            amount: row.amount,
            item_name: row.item_name,
            category_id: categoryId,
            merchant_id: merchantId,
            paid_by: row.paid_by || userId,
            expense_type: row.expense_type,
            payment_method: row.payment_method,
            expense_date: row.expense_date,
            notes: row.notes,
          },
        );

        if (created.error !== null) {
          results.push({ row: i + 1, itemName: row.item_name, success: false, reason: created.error });
          continue;
        }
        succeeded += 1;
        results.push({ row: i + 1, itemName: row.item_name, success: true, reason: null });
      } catch (err) {
        results.push({ row: i + 1, itemName: row.item_name, success: false, reason: err instanceof Error ? err.message : "Couldn't import this row" });
      }
    }

    return { succeeded, failed: results.length - succeeded, results };
  });
}
