"use server";

// Thin wrappers around the SQL analytics functions from migration 006. Every
// aggregation happens in Postgres — this file never pulls raw transactions
// into JS to sum them (spec section 48-50, 88: "do NOT fetch all expenses and
// calculate everything in React").

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getExpenses, type EnrichedExpense } from "@/lib/actions/expenses";
import { getPreviousComparableRange, getMonthRange, getPreviousMonthRange, type DateRange } from "@/lib/date-utils";
import { percentChange } from "@/lib/utils";
import type { Database } from "@/types/database";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
export type MerchantMonthlyTrendRow = Database["public"]["Functions"]["get_merchant_monthly_trend"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];
export type TopExpenseRow = {
  id: string;
  item_name: string;
  amount: string;
  expense_date: string;
  expense_time?: string | null;
  created_at?: string | null;
  category_id: string;
  merchant_id: string | null;
  paid_by: string;
};
type PaymentMethodBreakdownRow = Database["public"]["Functions"]["get_payment_method_breakdown"]["Returns"][number];

export type PersonFilter = "household" | "me" | "partner";

/**
 * "All" vs "Household Only" vs "Business Only" (spec: Task 4, separating the
 * `Homemade Business` category tree - migration 020 - from everyday
 * household living costs). "all" is the default and behaves exactly as
 * before this filter existed.
 */
export type CategoryScope = "all" | "household" | "business";

export interface AnalyticsFilters {
  range: DateRange;
  person: PersonFilter;
  categoryScope?: CategoryScope;
}

function resolvePaidBy(filters: AnalyticsFilters, userId: string, partnerId: string | null): string | null {
  if (filters.person === "me") return userId;
  if (filters.person === "partner") return partnerId ?? userId;
  return null; // household — no filter
}

/** "all" -> no filter needed at all (skip the extra query, matches every RPC's own null default). */
function resolveCategoryScopeArg(scope: CategoryScope | undefined): "household" | "business" | null {
  if (scope === "household" || scope === "business") return scope;
  return null;
}

/**
 * Which category ids fall under "Homemade Business" (itself + its
 * subcategories, migration 020) vs everything else, for the household. Only
 * needed for the direct `topExpensesQuery` (it queries `expenses` directly,
 * not through one of the RPCs in migration 021 that already do this
 * filtering in SQL) - every other breakdown gets its scoping from
 * `p_category_scope` on the RPC call itself.
 */
export async function resolveScopedCategoryIds(
  supabase: Awaited<ReturnType<typeof requireHouseholdContext>>["supabase"],
  householdId: string,
  scope: CategoryScope | undefined
): Promise<string[] | null> {
  const resolved = resolveCategoryScopeArg(scope);
  if (!resolved) return null;

  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, parent_id, name")
    .or(`household_id.eq.${householdId},household_id.is.null`);
  const rows = allCategories ?? [];

  const businessTop = rows.find((cat) => cat.name === "Homemade Business");
  const businessIds = new Set<string>();
  if (businessTop) {
    businessIds.add(businessTop.id);
    for (const cat of rows) {
      if (cat.parent_id === businessTop.id) businessIds.add(cat.id);
    }
  }

  if (resolved === "business") return Array.from(businessIds);
  return rows.map((cat) => cat.id).filter((id) => !businessIds.has(id));
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

    let topExpensesQuery = supabase
      .from("expenses")
      .select("id, item_name, amount, expense_date, expense_time, created_at, category_id, merchant_id, paid_by")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .gte("expense_date", filters.range.start)
      .lte("expense_date", filters.range.end)
      .order("amount", { ascending: false })
      .limit(5);

    if (paidBy) {
      topExpensesQuery = topExpensesQuery.eq("paid_by", paidBy);
    }

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
      topExpensesQuery,
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
      topExpenses: (topRes.data ?? []).map((e) => ({
        id: e.id,
        item_name: e.item_name,
        amount: String(e.amount),
        expense_date: e.expense_date,
        expense_time: e.expense_time ?? null,
        created_at: e.created_at ?? null,
        category_id: e.category_id,
        merchant_id: e.merchant_id ?? null,
        paid_by: e.paid_by,
      })),
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
    const categoryScope = resolveCategoryScopeArg(filters.categoryScope);

    let topExpensesQuery = supabase
      .from("expenses")
      .select("id, item_name, amount, expense_date, expense_time, created_at, category_id, merchant_id, paid_by")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .gte("expense_date", filters.range.start)
      .lte("expense_date", filters.range.end)
      .order("amount", { ascending: false })
      .limit(10);

    if (paidBy) {
      topExpensesQuery = topExpensesQuery.eq("paid_by", paidBy);
    }
    // Top Expenses queries `expenses` directly rather than through one of the
    // RPCs below, so it needs its own category-id filter for the scope
    // toggle - every other breakdown gets its filtering from p_category_scope.
    const scopedCategoryIds = await resolveScopedCategoryIds(supabase, householdId, filters.categoryScope);
    if (scopedCategoryIds) {
      topExpensesQuery = topExpensesQuery.in("category_id", scopedCategoryIds);
    }

    const [summaryRes, prevSummaryRes, categoryRes, prevCategoryRes, merchantRes, prevMerchantRes, itemRes, prevItemRes, dailyRes, topRes, personRes, paymentMethodRes] =
      await Promise.all([
        supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy, p_category_scope: categoryScope }),
        supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_paid_by: paidBy, p_category_scope: categoryScope }),
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy, p_category_scope: categoryScope }),
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_paid_by: paidBy, p_category_scope: categoryScope }),
        supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_limit: 20, p_category_scope: categoryScope }),
        supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 20, p_category_scope: categoryScope }),
        supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_limit: 30, p_category_scope: categoryScope }),
        supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 30, p_category_scope: categoryScope }),
        supabase.rpc("get_daily_spending", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_paid_by: paidBy, p_category_scope: categoryScope }),
        topExpensesQuery,
        supabase.rpc("get_person_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_category_scope: categoryScope }),
        supabase.rpc("get_payment_method_breakdown", { p_household_id: householdId, p_start: filters.range.start, p_end: filters.range.end, p_category_scope: categoryScope }),
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
      topExpenses: (topRes.data ?? []).map((e) => ({
        id: e.id,
        item_name: e.item_name,
        amount: String(e.amount),
        expense_date: e.expense_date,
        expense_time: e.expense_time ?? null,
        created_at: e.created_at ?? null,
        category_id: e.category_id,
        merchant_id: e.merchant_id ?? null,
        paid_by: e.paid_by,
      })),
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

export interface BusinessPnl {
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  incomeCount: number;
  expenseCount: number;
}

/**
 * Mini P&L for the Homemade Business (spec: "Mini P&L for Homemade
 * Business"): income vs. business expense for a date range, via the
 * get_business_pnl() RPC (migration 022 - not yet run against the live
 * project as of this writing, so callers should expect this to fail with a
 * "function does not exist" error until it is, and render an empty/neutral
 * state rather than crashing).
 */
export async function getBusinessPnl(range: DateRange) {
  return runAction(async (): Promise<BusinessPnl> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_business_pnl", {
      p_household_id: householdId,
      p_start: range.start,
      p_end: range.end,
    });
    if (error) throw new ActionError(error.message);
    const row = data?.[0];
    return {
      incomeTotal: row ? parseFloat(row.income_total) : 0,
      expenseTotal: row ? parseFloat(row.expense_total) : 0,
      netProfit: row ? parseFloat(row.net_profit) : 0,
      incomeCount: row ? Number(row.income_count) : 0,
      expenseCount: row ? Number(row.expense_count) : 0,
    };
  });
}

export interface IncomeByCategory {
  categoryId: string;
  categoryName: string;
  total: number;
  txnCount: number;
}

/**
 * Total household income for a range, broken down by top-level category
 * (Salary / Freelancing & Consulting / Business Sales & Payouts - migration
 * 023), via get_income_summary(). Distinct from getBusinessPnl, which only
 * ever answers for the Homemade Business itself.
 */
export async function getIncomeSummary(range: DateRange) {
  return runAction(async (): Promise<IncomeByCategory[]> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_income_summary", {
      p_household_id: householdId,
      p_start: range.start,
      p_end: range.end,
    });
    if (error) throw new ActionError(error.message);
    return (data ?? []).map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      total: parseFloat(row.total),
      txnCount: Number(row.txn_count),
    }));
  });
}

/** Per-category monthly trend for the small sparkline on the Category Analytics tab — mirrors getMerchantMonthlyTrend exactly. */
export async function getCategoryMonthlyTrend(categoryId: string, months = 6) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_category_monthly_trend", {
      p_household_id: householdId,
      p_category_id: categoryId,
      p_months: months,
    });
    if (error) throw new ActionError(error.message);
    return data ?? [];
  });
}

/** A merchant's share of its own category's total spend for the period (distinct from get_merchant_breakdown's share_pct, which is share of the household GRAND total). Returns the top category by the merchant's spend in it, or null if this merchant has no categorized spend in the range. */
export async function getMerchantCategoryShare(merchantId: string, range: DateRange) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.rpc("get_merchant_category_share", {
      p_household_id: householdId,
      p_merchant_id: merchantId,
      p_start: range.start,
      p_end: range.end,
    });
    if (error) throw new ActionError(error.message);
    return data?.[0] ?? null;
  });
}

export type CardBreakdownRow = Database["public"]["Functions"]["get_card_breakdown"]["Returns"][number];
export type UpiBreakdownRow = Database["public"]["Functions"]["get_upi_breakdown"]["Returns"][number];

export interface PaymentDepthData {
  cardBreakdown: CardBreakdownRow[];
  upiBreakdown: UpiBreakdownRow[];
  /** Top row of each breakdown, sorted by total spend — "most used" reads more usefully here than transaction count, since a card used for one large bill is arguably more "in use" than one tapped for a handful of tiny ones. */
  mostUsedCard: CardBreakdownRow | null;
  mostUsedUpi: UpiBreakdownRow | null;
}

/** Payment analytics depth (batch phase): breakdown by specific card and UPI profile (distinct from get_payment_method_breakdown's free-text payment_method grouping), plus each one's top/"most used" row. */
export async function getPaymentDepthData(range: DateRange) {
  return runAction(async (): Promise<PaymentDepthData> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const [cardRes, upiRes] = await Promise.all([
      supabase.rpc("get_card_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_upi_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
    ]);
    if (cardRes.error) throw new ActionError(cardRes.error.message);
    if (upiRes.error) throw new ActionError(upiRes.error.message);

    const cardBreakdown = cardRes.data ?? [];
    const upiBreakdown = upiRes.data ?? [];

    return {
      cardBreakdown,
      upiBreakdown,
      mostUsedCard: cardBreakdown[0] ?? null, // already sorted by total desc (get_card_breakdown)
      mostUsedUpi: upiBreakdown[0] ?? null, // already sorted by total desc (get_upi_breakdown)
    };
  });
}

export interface CashComparison {
  thisMonth: { total: number; txnCount: number };
  lastMonth: { total: number; txnCount: number };
  changePct: number | null;
}

/** Cash this-month-vs-last-month, filtered to the "Cash" row of the existing payment-method breakdown — no new SQL needed. */
export async function getCashComparison() {
  return runAction(async (): Promise<CashComparison> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const thisMonth = getMonthRange(0);
    const lastMonth = getPreviousMonthRange();

    const [thisRes, lastRes] = await Promise.all([
      supabase.rpc("get_payment_method_breakdown", { p_household_id: householdId, p_start: thisMonth.start, p_end: thisMonth.end }),
      supabase.rpc("get_payment_method_breakdown", { p_household_id: householdId, p_start: lastMonth.start, p_end: lastMonth.end }),
    ]);
    if (thisRes.error) throw new ActionError(thisRes.error.message);
    if (lastRes.error) throw new ActionError(lastRes.error.message);

    const thisCash = (thisRes.data ?? []).find((r) => r.payment_method === "Cash");
    const lastCash = (lastRes.data ?? []).find((r) => r.payment_method === "Cash");
    const thisTotal = Number(thisCash?.total ?? 0);
    const lastTotal = Number(lastCash?.total ?? 0);

    return {
      thisMonth: { total: thisTotal, txnCount: thisCash?.txn_count ?? 0 },
      lastMonth: { total: lastTotal, txnCount: lastCash?.txn_count ?? 0 },
      changePct: lastTotal > 0 ? percentChange(thisTotal, lastTotal) : null,
    };
  });
}

/** Daily totals for the spending calendar heatmap (spec section 8F, 33) — independent of the page's own period filter, driven by `monthsAgo`. */
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
