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
import type { SpendingChangesResult } from "@/lib/actions/insights";
import { daysBetweenISO, getPreviousComparableRange, getMonthRange, getPreviousMonthRange, type DateRange } from "@/lib/date-utils";
import { percentChange } from "@/lib/utils";

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

function computeCategoryChanges(
  currentRows: { category_id: string; category_name: string; total: number }[],
  previousRows: { category_id: string; category_name: string; total: number }[]
): SpendingChangesResult | null {
  const previousTotal = previousRows.reduce((sum, r) => sum + Number(r.total), 0);
  if (previousTotal <= 0) return null;

  const byCategory = new Map<string, { name: string; current: number; previous: number }>();
  for (const row of currentRows) {
    byCategory.set(row.category_id, { name: row.category_name, current: Number(row.total), previous: 0 });
  }
  for (const row of previousRows) {
    const existing = byCategory.get(row.category_id);
    if (existing) existing.previous = Number(row.total);
    else byCategory.set(row.category_id, { name: row.category_name, current: 0, previous: Number(row.total) });
  }

  const merged = Array.from(byCategory.entries()).map(([category_id, v]) => ({
    category_id,
    category_name: v.name,
    current: v.current,
    previous: v.previous,
    diff: v.current - v.previous,
    changePct: percentChange(v.current, v.previous),
  }));

  merged.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const top5 = merged.slice(0, 5);
  if (top5.every((c) => c.diff === 0)) return null;

  const changes = top5.map(({ category_id, category_name, current: c, previous: p, changePct }) => ({
    category_id,
    category_name,
    current: c,
    previous: p,
    changePct,
  }));

  const topMover = top5[0];
  const sameDirection = (top5.some((c) => c.diff !== 0) ? top5 : []).filter(
    (c) => Math.sign(c.diff) === Math.sign(topMover.diff) && c.diff !== 0
  );
  const names = sameDirection.slice(0, 2).map((c) => c.category_name);
  const namesLabel = names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
  const summary =
    topMover.diff > 0
      ? `Spending in ${namesLabel} ran higher this month than last.`
      : `Spending in ${namesLabel} dropped compared to last month.`;

  return { changes, summary };
}

export async function getSpendingIntelligence(range: DateRange) {
  return runAction(async (): Promise<SpendingIntelligenceData> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const previousRange = getPreviousComparableRange(range);
    const month = getMonthRange(0);
    const prevMonth = getPreviousMonthRange();

    // Single consolidated master RPC executing all aggregations in 1 database round-trip
    const { data: bundle, error } = await supabase.rpc("get_spending_intelligence_bundle", {
      p_household_id: householdId,
      p_start: range.start,
      p_end: range.end,
      p_prev_start: previousRange.start,
      p_prev_end: previousRange.end,
      p_month_start: month.start,
      p_month_end: month.end,
      p_prev_month_start: prevMonth.start,
      p_prev_month_end: prevMonth.end,
    });

    if (error) throw new ActionError(error.message);
    if (!bundle) throw new ActionError("No data returned from database");

    const summary = bundle.summary;
    const txnCount = summary.txn_count ?? 0;
    const days = daysBetweenISO(range.start, range.end);
    const weeks = days / 7;
    const total = Number(summary.total ?? 0);

    // Weekday peak
    const weekdayRows = bundle.weekday_rows ?? [];
    const weekdayPeak: WeekdayPeak | null =
      txnCount >= MIN_TXN_FOR_PEAK_GUARDS && weekdayRows.length > 0
        ? { weekdayName: WEEKDAY_NAMES[weekdayRows[0].weekday_num] ?? "Unknown", total: Number(weekdayRows[0].total) }
        : null;

    // Highest single date
    const dailyRows = bundle.daily_rows ?? [];
    const highestDay = dailyRows.length > 0 ? dailyRows.reduce((a, b) => (Number(b.total) > Number(a.total) ? b : a)) : null;
    const datePeak: DatePeak | null =
      txnCount >= MIN_TXN_FOR_PEAK_GUARDS && highestDay ? { date: highestDay.expense_date, total: Number(highestDay.total) } : null;

    const avgDailySpend = days > 0 ? total / days : 0;
    const avgWeeklySpend = weeks > 0 ? total / weeks : 0;

    const personSplit: PersonSplit = {
      byExpenseType: (bundle.expense_type_rows ?? []).map((row) => ({
        expenseType: row.expense_type,
        total: Number(row.total),
        txnCount: row.txn_count,
        sharePct: Number(row.share_pct),
      })),
      byPayer: (bundle.person_rows ?? []).map((row) => ({
        userId: row.paid_by,
        name: row.name,
        total: Number(row.total),
        txnCount: row.txn_count,
        avgTransaction: Number(row.avg_transaction),
      })),
    };

    const recurringRow = bundle.recurring_row;
    const recurringVsOneoff: RecurringVsOneoff = {
      recurringTotal: Number(recurringRow?.recurring_total ?? 0),
      recurringCount: recurringRow?.recurring_count ?? 0,
      oneoffTotal: Number(recurringRow?.oneoff_total ?? 0),
      oneoffCount: recurringRow?.oneoff_count ?? 0,
    };

    const merchantPrevRows = bundle.merchant_prev_rows ?? [];
    const previousMerchantTotal = merchantPrevRows.reduce((sum, r) => sum + Number(r.total), 0);
    const topMerchantChanges =
      previousMerchantTotal > MIN_PREVIOUS_TOTAL_FOR_COMPARISON
        ? diffBreakdowns(
            (bundle.merchant_current_rows ?? []).map((r) => ({ key: r.merchant_id, name: r.merchant_name, total: Number(r.total) })),
            merchantPrevRows.map((r) => ({ key: r.merchant_id, name: r.merchant_name, total: Number(r.total) })),
            5
          )
        : [];

    const itemPrevRows = bundle.item_prev_rows ?? [];
    const previousItemTotal = itemPrevRows.reduce((sum, r) => sum + Number(r.total), 0);
    const topItemChanges =
      previousItemTotal > MIN_PREVIOUS_TOTAL_FOR_COMPARISON
        ? diffBreakdowns(
            (bundle.item_current_rows ?? []).map((r) => ({ key: r.item_name, name: r.item_name, total: Number(r.total) })),
            itemPrevRows.map((r) => ({ key: r.item_name, name: r.item_name, total: Number(r.total) })),
            5
          )
        : [];

    const categoryChanges = computeCategoryChanges(
      (bundle.category_month_rows ?? []).map((r) => ({ category_id: r.category_id, category_name: r.category_name, total: Number(r.total) })),
      (bundle.category_prev_month_rows ?? []).map((r) => ({ category_id: r.category_id, category_name: r.category_name, total: Number(r.total) }))
    );

    return {
      range,
      previousRange,
      weekdayPeak,
      datePeak,
      avgDailySpend,
      avgWeeklySpend,
      personSplit,
      recurringVsOneoff,
      categoryChanges,
      topMerchantChanges,
      topItemChanges,
    };
  });
}
