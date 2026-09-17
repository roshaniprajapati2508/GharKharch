"use server";

// Thin wrappers around the SQL analytics functions from migration 006. Every
// aggregation happens in Postgres - this file never pulls raw transactions
// into JS to sum them (spec section 48-50, 88: "do NOT fetch all expenses and
// calculate everything in React").

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getExpenses, type EnrichedExpense } from "@/lib/actions/expenses";
import { getPreviousComparableRange, getMonthRange, type DateRange } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type MerchantMonthlyTrendRow = Database["public"]["Functions"]["get_merchant_monthly_trend"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];
type TopExpenseRow = Database["public"]["Functions"]["get_top_expenses"]["Returns"][number];
type PaymentMethodBreakdownRow = Database["public"]["Functions"]["get_payment_method_breakdown"]["Returns"][number];

export type PersonFilter = "household" | "me" | "partner";

export interface AnalyticsFilters {
  range: DateRange;
  person: PersonFilter;
}

function resolvePaidBy(filters: AnalyticsFilters, userId: string, partnerId: string | null): string | null {
  if (filters.person === "me") return userId;
  if (filters.person === "partner") return partnerId ?? userId;
  return null; // household - no filter
}

const EMPTY_SUMMARY: ExpenseSummaryRow = {
  total: "0",
  txn_count: 0,
  avg_transaction: "0",
  days: 0,
  largest_amount: null,
  largest_expense_id: null,
};

export interface DashboardData {
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categoryBreakdown: CategoryBreakdownRow[];
  previousCategoryBreakdown: CategoryBreakdownRow[];
  personBreakdown: PersonBreakdownRow[];
  topMerchants: MerchantBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
  dailySpending: DailySpendingRow[];
  topExpenses: TopExpenseRow[];
  recentExpenses: EnrichedExpense[];
  range: DateRange;
  previousRange: DateRange;
}

/**
 * One consolidated call for the whole dashboard (spec section 88: avoid
 * scattering database logic and round-trips across many small components).
 */
export async function getDashboardData(filters: AnalyticsFilters) {
  return runAction(async (): Promise<DashboardData> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId);
    const partnerId = (members ?? []).map((m) => m.user_id).find((id) => id !== userId) ?? null;

    const paidBy = resolvePaidBy(filters, userId, partnerId);
    const previousRange = getPreviousComparableRange(filters.range);

    const [summaryRes, prevSummaryRes, categoryRes, prevCategoryRes, personRes, merchantRes, itemRes, dailyRes, topRes, recentRes] = await Promise.all([
      supabase.rpc("get_expense_summary", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_paid_by: paidBy,
      }),
      supabase.rpc("get_expense_summary", {
        p_household_id: householdId,
        p_start: previousRange.start,
        p_end: previousRange.end,
        p_paid_by: paidBy,
      }),
      supabase.rpc("get_category_breakdown", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_paid_by: paidBy,
      }),
      supabase.rpc("get_category_breakdown", {
        p_household_id: householdId,
        p_start: previousRange.start,
        p_end: previousRange.end,
        p_paid_by: paidBy,
      }),
      supabase.rpc("get_person_breakdown", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
      }),
      supabase.rpc("get_merchant_breakdown", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_limit: 20, // wider than the 5 shown in the UI list, so "most frequent merchant" can be derived client-side without another round trip
      }),
      supabase.rpc("get_item_analytics", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_limit: 10,
      }),
      supabase.rpc("get_daily_spending", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_paid_by: paidBy,
      }),
      supabase.rpc("get_top_expenses", {
        p_household_id: householdId,
        p_start: filters.range.start,
        p_end: filters.range.end,
        p_limit: 5,
      }),
      getExpenses({ start: filters.range.start, end: filters.range.end, paidBy: paidBy ?? "all", sort: "newest", limit: 8 }),
    ]);

    if (summaryRes.error) throw new ActionError(summaryRes.error.message);
    if (categoryRes.error) throw new ActionError(categoryRes.error.message);
    if (personRes.error) throw new ActionError(personRes.error.message);
    if (merchantRes.error) throw new ActionError(merchantRes.error.message);
    if (itemRes.error) throw new ActionError(itemRes.error.message);
    if (dailyRes.error) throw new ActionError(dailyRes.error.message);
    if (topRes.error) throw new ActionError(topRes.error.message);
    if (recentRes.error !== null) throw new ActionError(recentRes.error);

    return {
      summary: summaryRes.data?.[0] ?? EMPTY_SUMMARY,
      previousSummary: prevSummaryRes.data?.[0] ?? EMPTY_SUMMARY,
      categoryBreakdown: categoryRes.data ?? [],
      previousCategoryBreakdown: prevCategoryRes.data ?? [],
      personBreakdown: personRes.data ?? [],
      topMerchants: merchantRes.data ?? [],
      itemAnalytics: itemRes.data ?? [],
      dailySpending: dailyRes.data ?? [],
      topExpenses: topRes.data ?? [],
      recentExpenses: recentRes.data ?? [],
      range: filters.range,
      previousRange,
    };
  });
}

export interface AnalyticsPageData {
  categoryBreakdown: CategoryBreakdownRow[];
  previousCategoryBreakdown: CategoryBreakdownRow[];
  merchantBreakdown: MerchantBreakdownRow[];
  previousMerchantBreakdown: MerchantBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
  previousItemAnalytics: ItemAnalyticsRow[];
  dailySpending: DailySpendingRow[];
  topExpenses: TopExpenseRow[];
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  personBreakdown: PersonBreakdownRow[];
  paymentMethodBreakdown: PaymentMethodBreakdownRow[];
  range: DateRange;
  previousRange: DateRange;
}

/** Backing data for the Analytics screen (spec sections 23-29, 33): every
 * breakdown the category/merchant/item/frequency/comparison tabs need, fetched
 * once per filter change. */
export async function getAnalyticsData(filters: AnalyticsFilters) {
  return runAction(async (): Promise<AnalyticsPageData> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId);
    const partnerId = (members ?? []).map((m) => m.user_id).find((id) => id !== userId) ?? null;
    const paidBy = resolvePaidBy(filters, userId, partnerId);
    const previousRange = getPreviousComparableRange(filters.range);

    const [summaryRes, prevSummaryRes, categoryRes, prevCategoryRes, merchantRes, prevMerchantRes, itemRes, prevItemRes, dailyRes, topRes, personRes, paymentMethodRes] =
      await Promise.all([
        supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy }),
        supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_paid_by: paidBy }),
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy }),
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_paid_by: paidBy }),
        supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_limit: 20 }),
        supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 20 }),
        supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_limit: 30 }),
        supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 30 }),
        supabase.rpc("get_daily_spending", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy }),
        supabase.rpc("get_top_expenses", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_limit: 10 }),
        supabase.rpc("get_person_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end }),
        supabase.rpc("get_payment_method_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end }),
      ]);

    if (summaryRes.error) throw new ActionError(summaryRes.error.message);
    if (categoryRes.error) throw new ActionError(categoryRes.error.message);
    if (merchantRes.error) throw new ActionError(merchantRes.error.message);
    if (itemRes.error) throw new ActionError(itemRes.error.message);
    if (dailyRes.error) throw new ActionError(dailyRes.error.message);
    if (topRes.error) throw new ActionError(topRes.error.message);
    if (personRes.error) throw new ActionError(personRes.error.message);
    if (paymentMethodRes.error) throw new ActionError(paymentMethodRes.error.message);

    return {
      categoryBreakdown: categoryRes.data ?? [],
      previousCategoryBreakdown: prevCategoryRes.data ?? [],
      merchantBreakdown: merchantRes.data ?? [],
      previousMerchantBreakdown: prevMerchantRes.data ?? [],
      itemAnalytics: itemRes.data ?? [],
      previousItemAnalytics: prevItemRes.data ?? [],
      dailySpending: dailyRes.data ?? [],
      topExpenses: topRes.data ?? [],
      summary: summaryRes.data?.[0] ?? EMPTY_SUMMARY,
      previousSummary: prevSummaryRes.data?.[0] ?? EMPTY_SUMMARY,
      personBreakdown: personRes.data ?? [],
      paymentMethodBreakdown: paymentMethodRes.data ?? [],
      range: filters.range,
      previousRange,
    };
  });
}

/** Per-merchant monthly trend for the small sparkline on the Merchants tab (spec section 25). */
export async function getMerchantMonthlyTrend(merchantId: string, months = 6) {
  return runAction(async (): Promise<MerchantMonthlyTrendRow[]> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_merchant_monthly_trend", {
      p_household_id: householdId,
      p_merchant_id: merchantId,
      p_months: months,
    });
    if (error) throw new ActionError(error.message);
    return data ?? [];
  });
}

/** Daily totals for the spending calendar heatmap (spec section 8F, 33) - independent of the page's own period filter, driven by `monthsAgo`. */
export async function getCalendarMonthData(monthsAgo: number) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const range = getMonthRange(monthsAgo);

    const { data, error } = await supabase.rpc("get_daily_spending", {
      p_household_id: householdId,
      p_start: range.start,
      p_end: range.end,
    });
    if (error) throw new ActionError(error.message);

    return { range, days: data ?? [] };
  });
}
