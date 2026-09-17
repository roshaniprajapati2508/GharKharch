"use server";

// "Spending Intelligence" (batch phase): a single consolidated action for the
// /analytics/intelligence page, built the same way analytics.ts and
// insights.ts already are — every aggregation happens in Postgres via
// existing or new RPCs, never by fetching a household's raw expense history
// into JS to sum it (spec section 48-50, 88). All figures are computed from
// real queries for the given period; nothing here is fabricated, and nothing
// is described in judgmental language ("wasted", "bad") — only neutral,
// factual statements about where money moved.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getSpendingChanges, type SpendingChangesResult } from "@/lib/actions/insights";
import { daysBetweenISO, getPreviousComparableRange, type DateRange } from "@/lib/date-utils";
import { percentChange } from "@/lib/utils";
import type { Database } from "@/types/database";

type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Below this many transactions in the range, a "highest weekday" or "highest
// single date" figure is more noise than signal (e.g. one large purchase on
// a Tuesday doesn't mean Tuesdays run high) — same reasoning insights.ts and
// budgets.ts already use for not projecting/comparing off too little data.
const MIN_TXN_FOR_PEAK_GUARDS = 8;
// A meaningful "vs previous period" comparison needs the previous period to
// have had real spend to compare against, mirroring getSpendingChanges' own guard.
const MIN_PREVIOUS_TOTAL_FOR_COMPARISON = 0;

export interface WeekdayPeak {
  weekdayName: string;
  total: number;
}

export interface DatePeak {
  date: string;
  total: number;
}

export interface PersonSplit {
  byExpenseType: { expenseType: string; total: number; txnCount: number; sharePct: number }[];
  byPayer: { userId: string; name: string; total: number; txnCount: number; avgTransaction: number }[];
}

export interface RecurringVsOneoff {
  recurringTotal: number;
  recurringCount: number;
  oneoffTotal: number;
  oneoffCount: number;
}

export interface RankedChange {
  name: string;
  current: number;
  previous: number;
  changePct: number | null;
}

export interface SpendingIntelligenceData {
  range: DateRange;
  previousRange: DateRange;
  weekdayPeak: WeekdayPeak | null;
  datePeak: DatePeak | null;
  avgDailySpend: number;
  avgWeeklySpend: number;
  personSplit: PersonSplit;
  recurringVsOneoff: RecurringVsOneoff;
  categoryChanges: SpendingChangesResult | null;
  topMerchantChanges: RankedChange[];
  topItemChanges: RankedChange[];
}

/** Diffs two breakdown-shaped result sets (merchant or item analytics, current vs the previous comparable period) and returns the top movers by absolute change — same merge/sort approach getSpendingChanges already uses for categories. */
function diffBreakdowns(
  currentRows: { key: string; name: string; total: number }[],
  previousRows: { key: string; name: string; total: number }[],
  limit: number
): RankedChange[] {
  const byKey = new Map<string, { name: string; current: number; previous: number }>();
  for (const row of currentRows) byKey.set(row.key, { name: row.name, current: row.total, previous: 0 });
  for (const row of previousRows) {
    const existing = byKey.get(row.key);
    if (existing) existing.previous = row.total;
    else byKey.set(row.key, { name: row.name, current: 0, previous: row.total });
  }
  const merged = Array.from(byKey.values()).map((v) => ({
    name: v.name,
    current: v.current,
    previous: v.previous,
    diff: v.current - v.previous,
    changePct: percentChange(v.current, v.previous),
  }));
  merged.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return merged
    .filter((m) => m.diff !== 0)
    .slice(0, limit)
    .map(({ name, current, previous, changePct }) => ({ name, current, previous, changePct }));
}

export async function getSpendingIntelligence(range: DateRange) {
  return runAction(async (): Promise<SpendingIntelligenceData> => {
    const { supabase, householdId, userId } = await requireHouseholdContext();
    const previousRange = getPreviousComparableRange(range);

    const [
      summaryRes,
      weekdayRes,
      dailyRes,
      expenseTypeRes,
      personRes,
      recurringRes,
      membersRes,
      profilesRes,
      merchantCurrentRes,
      merchantPreviousRes,
      itemCurrentRes,
      itemPreviousRes,
      categoryChangesResult,
    ] = await Promise.all([
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_paid_by: null }),
      supabase.rpc("get_spending_by_weekday", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_daily_spending", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_paid_by: null }),
      supabase.rpc("get_expense_type_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_person_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.rpc("get_recurring_vs_oneoff", { p_household_id: householdId, p_start: range.start, p_end: range.end }),
      supabase.from("household_members").select("user_id").eq("household_id", householdId),
      supabase.from("profiles").select("id, display_name"),
      supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_limit: 50 }),
      supabase.rpc("get_merchant_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 50 }),
      supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: range.start, p_end: range.end, p_limit: 50 }),
      supabase.rpc("get_item_analytics", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end, p_limit: 50 }),
      getSpendingChanges(),
    ]);

    if (summaryRes.error) throw new ActionError(summaryRes.error.message);
    if (weekdayRes.error) throw new ActionError(weekdayRes.error.message);
    if (dailyRes.error) throw new ActionError(dailyRes.error.message);
    if (expenseTypeRes.error) throw new ActionError(expenseTypeRes.error.message);
    if (personRes.error) throw new ActionError(personRes.error.message);
    if (recurringRes.error) throw new ActionError(recurringRes.error.message);
    if (merchantCurrentRes.error) throw new ActionError(merchantCurrentRes.error.message);
    if (merchantPreviousRes.error) throw new ActionError(merchantPreviousRes.error.message);
    if (itemCurrentRes.error) throw new ActionError(itemCurrentRes.error.message);
    if (itemPreviousRes.error) throw new ActionError(itemPreviousRes.error.message);

    const txnCount = summaryRes.data?.[0]?.txn_count ?? 0;
    const days = daysBetweenISO(range.start, range.end);
    const weeks = days / 7;
    const total = Number(summaryRes.data?.[0]?.total ?? 0);

    // Weekday peak — only meaningful with enough transactions to not be one outlier.
    const weekdayRows = weekdayRes.data ?? [];
    const weekdayPeak: WeekdayPeak | null =
      txnCount >= MIN_TXN_FOR_PEAK_GUARDS && weekdayRows.length > 0
        ? { weekdayName: WEEKDAY_NAMES[weekdayRows[0].weekday_num] ?? "Unknown", total: Number(weekdayRows[0].total) }
        : null;

    // Highest single date — reuses the existing daily-spending series rather than a new function.
    const dailyRows = dailyRes.data ?? [];
    const highestDay = dailyRows.length > 0 ? dailyRows.reduce((a, b) => (Number(b.total) > Number(a.total) ? b : a)) : null;
    const datePeak: DatePeak | null =
      txnCount >= MIN_TXN_FOR_PEAK_GUARDS && highestDay ? { date: highestDay.expense_date, total: Number(highestDay.total) } : null;

    const avgDailySpend = days > 0 ? total / days : 0;
    const avgWeeklySpend = weeks > 0 ? total / weeks : 0;

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));
    void membersRes;

    const personSplit: PersonSplit = {
      byExpenseType: (expenseTypeRes.data ?? []).map((row) => ({
        expenseType: row.expense_type,
        total: Number(row.total),
        txnCount: row.txn_count,
        sharePct: Number(row.share_pct),
      })),
      byPayer: (personRes.data ?? []).map((row) => ({
        userId: row.paid_by,
        name: profileMap.get(row.paid_by) ?? "Someone",
        total: Number(row.total),
        txnCount: row.txn_count,
        avgTransaction: Number(row.avg_transaction),
      })),
    };
    void userId;

    const recurringRow = recurringRes.data?.[0];
    const recurringVsOneoff: RecurringVsOneoff = {
      recurringTotal: Number(recurringRow?.recurring_total ?? 0),
      recurringCount: recurringRow?.recurring_count ?? 0,
      oneoffTotal: Number(recurringRow?.oneoff_total ?? 0),
      oneoffCount: recurringRow?.oneoff_count ?? 0,
    };

    const previousMerchantTotal = (merchantPreviousRes.data ?? []).reduce((sum: number, r: MerchantBreakdownRow) => sum + Number(r.total), 0);
    const topMerchantChanges =
      previousMerchantTotal > MIN_PREVIOUS_TOTAL_FOR_COMPARISON
        ? diffBreakdowns(
            (merchantCurrentRes.data ?? []).map((r: MerchantBreakdownRow) => ({ key: r.merchant_id, name: r.merchant_name, total: Number(r.total) })),
            (merchantPreviousRes.data ?? []).map((r: MerchantBreakdownRow) => ({ key: r.merchant_id, name: r.merchant_name, total: Number(r.total) })),
            5
          )
        : [];

    const previousItemTotal = (itemPreviousRes.data ?? []).reduce((sum: number, r: ItemAnalyticsRow) => sum + Number(r.total), 0);
    const topItemChanges =
      previousItemTotal > MIN_PREVIOUS_TOTAL_FOR_COMPARISON
        ? diffBreakdowns(
            (itemCurrentRes.data ?? []).map((r: ItemAnalyticsRow) => ({ key: r.item_name, name: r.item_name, total: Number(r.total) })),
            (itemPreviousRes.data ?? []).map((r: ItemAnalyticsRow) => ({ key: r.item_name, name: r.item_name, total: Number(r.total) })),
            5
          )
        : [];

    return {
      range,
      previousRange,
      weekdayPeak,
      datePeak,
      avgDailySpend,
      avgWeeklySpend,
      personSplit,
      recurringVsOneoff,
      categoryChanges: categoryChangesResult.error === null ? categoryChangesResult.data : null,
      topMerchantChanges,
      topItemChanges,
    };
  });
}
