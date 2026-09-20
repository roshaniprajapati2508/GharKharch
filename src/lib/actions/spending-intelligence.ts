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

export interface WeekdayRow {
  weekdayNum: number;
  weekdayName: string;
  shortName: string;
  total: number;
  txnCount: number;
  sharePct: number;
}

export interface SummaryMetrics {
  total: number;
  txnCount: number;
  avgTransaction: number;
  previousTotal: number;
  changePct: number | null;
}

export interface SpendingIntelligenceData {
  range: DateRange;
  previousRange: DateRange;
  summary: SummaryMetrics;
  weekdayPeak: WeekdayPeak | null;
  datePeak: DatePeak | null;
  avgDailySpend: number;
  avgWeeklySpend: number;
  projectedMonthEnd: number | null;
  weekdayBreakdown: WeekdayRow[];
  personSplit: PersonSplit;
  recurringVsOneoff: RecurringVsOneoff & { recurringSharePct: number };
  categoryChanges: SpendingChangesResult | null;
  topMerchantChanges: RankedChange[];
  topItemChanges: RankedChange[];
  smartTakeaways: string[];
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

    const rawSummary = bundle.summary;
    const txnCount = rawSummary?.txn_count ?? 0;
    const days = Math.max(1, daysBetweenISO(range.start, range.end));
    const weeks = Math.max(1, days / 7);
    const total = Number(rawSummary?.total ?? 0);
    const avgTransaction = Number(rawSummary?.avg_transaction ?? (txnCount > 0 ? total / txnCount : 0));

    // Previous total from previous month or previous breakdown
    const categoryPrevMonthRows = bundle.category_prev_month_rows ?? [];
    const prevMonthTotal = categoryPrevMonthRows.reduce((sum, r) => sum + Number(r.total), 0);
    const previousMerchantRows = bundle.merchant_prev_rows ?? [];
    const prevMerchantTotal = previousMerchantRows.reduce((sum, r) => sum + Number(r.total), 0);
    const previousTotal = prevMonthTotal > 0 ? prevMonthTotal : prevMerchantTotal;
    const changePct = previousTotal > 0 ? percentChange(total, previousTotal) : null;

    const summary: SummaryMetrics = {
      total,
      txnCount,
      avgTransaction,
      previousTotal,
      changePct,
    };

    // Weekday breakdown (Mon-Sun)
    const rawWeekdayRows = (bundle.weekday_rows ?? []) as { weekday_num: number; total: number; txn_count: number }[];
    const weekdayMap = new Map<number, { total: number; txn_count: number }>();
    for (const row of rawWeekdayRows) {
      weekdayMap.set(row.weekday_num, { total: Number(row.total), txn_count: row.txn_count });
    }

    const SHORT_WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Display in order Monday (1) to Sunday (0)
    const displayOrder = [1, 2, 3, 4, 5, 6, 0];
    const weekdayBreakdown: WeekdayRow[] = displayOrder.map((num) => {
      const data = weekdayMap.get(num) ?? { total: 0, txn_count: 0 };
      const sharePct = total > 0 ? (data.total / total) * 100 : 0;
      return {
        weekdayNum: num,
        weekdayName: WEEKDAY_NAMES[num],
        shortName: SHORT_WEEKDAY_NAMES[num],
        total: data.total,
        txnCount: data.txn_count,
        sharePct,
      };
    });

    // Weekday peak
    const sortedWeekdays = [...rawWeekdayRows].sort((a, b) => Number(b.total) - Number(a.total));
    const weekdayPeak: WeekdayPeak | null =
      sortedWeekdays.length > 0 && Number(sortedWeekdays[0].total) > 0
        ? { weekdayName: WEEKDAY_NAMES[sortedWeekdays[0].weekday_num] ?? "Unknown", total: Number(sortedWeekdays[0].total) }
        : null;

    // Highest single date
    const dailyRows = bundle.daily_rows ?? [];
    const highestDay = dailyRows.length > 0 ? dailyRows.reduce((a, b) => (Number(b.total) > Number(a.total) ? b : a)) : null;
    const datePeak: DatePeak | null =
      highestDay && Number(highestDay.total) > 0 ? { date: highestDay.expense_date, total: Number(highestDay.total) } : null;

    const avgDailySpend = total / days;
    const avgWeeklySpend = total / weeks;

    // Month-end projection
    const today = new Date();
    const isCurrentMonth = range.start === month.start && range.end === month.end;
    const currentDay = today.getDate();
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const projectedMonthEnd = isCurrentMonth && currentDay > 0 ? (total / currentDay) * daysInCurrentMonth : null;

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
    const recTotal = Number(recurringRow?.recurring_total ?? 0);
    const oneTotal = Number(recurringRow?.oneoff_total ?? 0);
    const recurringSharePct = total > 0 ? (recTotal / total) * 100 : 0;
    const recurringVsOneoff = {
      recurringTotal: recTotal,
      recurringCount: recurringRow?.recurring_count ?? 0,
      oneoffTotal: oneTotal,
      oneoffCount: recurringRow?.oneoff_count ?? 0,
      recurringSharePct,
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
      categoryPrevMonthRows.map((r) => ({ category_id: r.category_id, category_name: r.category_name, total: Number(r.total) }))
    );

    // Smart factual takeaways
    const smartTakeaways: string[] = [];
    if (avgDailySpend > 0) {
      smartTakeaways.push(
        projectedMonthEnd
          ? `Spending pace is ₹${Math.round(avgDailySpend).toLocaleString("en-IN")}/day (on track for ₹${Math.round(projectedMonthEnd).toLocaleString("en-IN")} this month).`
          : `Average spend velocity is ₹${Math.round(avgDailySpend).toLocaleString("en-IN")}/day (₹${Math.round(avgWeeklySpend).toLocaleString("en-IN")}/week).`
      );
    }
    if (weekdayPeak && total > 0) {
      const peakShare = Math.round((weekdayPeak.total / total) * 100);
      smartTakeaways.push(`${weekdayPeak.weekdayName}s account for highest volume at ₹${Math.round(weekdayPeak.total).toLocaleString("en-IN")} (${peakShare}% of total).`);
    }
    if (personSplit.byPayer.length >= 2) {
      const p1 = personSplit.byPayer[0];
      const p2 = personSplit.byPayer[1];
      const p1Pct = total > 0 ? Math.round((p1.total / total) * 100) : 50;
      const p2Pct = 100 - p1Pct;
      smartTakeaways.push(`Payer split: ${p1.name} paid ${p1Pct}%, ${p2.name} paid ${p2Pct}%.`);
    }
    if (recurringSharePct > 0) {
      smartTakeaways.push(`Fixed & recurring bills make up ${Math.round(recurringSharePct)}% of spending (₹${Math.round(recTotal).toLocaleString("en-IN")}).`);
    }
    if (categoryChanges && categoryChanges.changes.length > 0) {
      const topCat = categoryChanges.changes[0];
      if (topCat.changePct !== null && Math.abs(topCat.changePct) > 10) {
        smartTakeaways.push(
          topCat.current > topCat.previous
            ? `${topCat.category_name} spending increased by ${Math.abs(Math.round(topCat.changePct))}% vs previous period.`
            : `${topCat.category_name} spending reduced by ${Math.abs(Math.round(topCat.changePct))}% vs previous period.`
        );
      }
    }

    return {
      range,
      previousRange,
      summary,
      weekdayPeak,
      datePeak,
      avgDailySpend,
      avgWeeklySpend,
      projectedMonthEnd,
      weekdayBreakdown,
      personSplit,
      recurringVsOneoff,
      categoryChanges,
      topMerchantChanges,
      topItemChanges,
      smartTakeaways,
    };
  });
}
