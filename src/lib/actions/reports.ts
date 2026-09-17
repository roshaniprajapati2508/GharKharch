"use server";

// Report generation (spec sections 31, 32, 62): reuses the same Phase 4
// aggregate functions as the Analytics screen — a report is just a curated,
// presentation-focused view over the same server-aggregated numbers.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getExpenses, type EnrichedExpense } from "@/lib/actions/expenses";
import { getPreviousComparableRange, type DateRange } from "@/lib/date-utils";
import type { Database } from "@/types/database";

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
