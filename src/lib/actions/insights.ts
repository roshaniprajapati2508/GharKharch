"use server";

// "Always current" dashboard intelligence — deliberately separate from
// analytics.ts (which is period/range driven for the Analytics screen). Every
// function here answers "what's true right now" rather than "what happened
// in the filter range the user picked", so each one computes its own dates
// off Asia/Kolkata "today" instead of taking a range from the caller.
//
// Same rules as the rest of the codebase (spec section 48-50, 88): aggregate
// in Postgres via the existing `get_expense_summary` / `get_category_breakdown`
// RPCs wherever possible, never fetch a household's whole expense history into
// JS to sum it. The one exception is getItemPriceMemory, which needs the raw
// per-purchase amounts (not just a sum) and is bounded to a handful of rows
// for one specific item name.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getTodayISO, getWeekRange, getMonthRange, getPreviousMonthRange, addDaysISO, daysBetweenISO } from "@/lib/date-utils";
import { percentChange } from "@/lib/utils";

export interface DailyWeeklySnapshot {
  todayTotal: number;
  todayCount: number;
  weekTotal: number;
  /** % change vs the equivalent elapsed portion of the previous week — null when the previous week has no data to compare against. */
  weekChangePct: number | null;
}

/** Today's spend + week-to-date, compared like-for-like against the same number of elapsed days last week (spec-style dashboard snapshot, not a period-filtered analytic). */
export async function getDailyWeeklySnapshot() {
  return runAction(async (): Promise<DailyWeeklySnapshot> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const today = getTodayISO();
    const week = getWeekRange(); // Monday-start, matching the rest of the app's convention (date-utils.ts, reports-page-client.tsx)
    const daysElapsed = daysBetweenISO(week.start, today);
    const prevWeekStart = addDaysISO(week.start, -7);
    const prevWeekEnd = addDaysISO(week.end, -7);
    // The comparable portion of last week — same number of elapsed days from its own start — so a
    // partial current week is never compared against a full previous week (that would be misleading).
    const prevComparableEnd = addDaysISO(prevWeekStart, daysElapsed - 1);

    const [todayRes, weekRes, prevFullWeekRes, prevComparableRes] = await Promise.all([
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: today, p_end: today, p_paid_by: null }),
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: week.start, p_end: today, p_paid_by: null }),
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: prevWeekStart, p_end: prevWeekEnd, p_paid_by: null }),
      supabase.rpc("get_expense_summary", { p_household_id: householdId, p_start: prevWeekStart, p_end: prevComparableEnd, p_paid_by: null }),
    ]);

    if (todayRes.error) throw new ActionError(todayRes.error.message);
    if (weekRes.error) throw new ActionError(weekRes.error.message);
    if (prevFullWeekRes.error) throw new ActionError(prevFullWeekRes.error.message);
    if (prevComparableRes.error) throw new ActionError(prevComparableRes.error.message);

    const todayTotal = Number(todayRes.data?.[0]?.total ?? 0);
    const todayCount = todayRes.data?.[0]?.txn_count ?? 0;
    const weekTotal = Number(weekRes.data?.[0]?.total ?? 0);
    const prevFullWeekHasData = (prevFullWeekRes.data?.[0]?.txn_count ?? 0) > 0;
    const prevComparableTotal = Number(prevComparableRes.data?.[0]?.total ?? 0);

    return {
      todayTotal,
      todayCount,
      weekTotal,
      weekChangePct: prevFullWeekHasData ? percentChange(weekTotal, prevComparableTotal) : null,
    };
  });
}

export interface HouseholdForecast {
  spentSoFar: number;
  projected: number;
  daysElapsed: number;
  daysInMonth: number;
}

/**
 * Household-wide current-month projection — simple current-pace extrapolation
 * (spentSoFar / daysElapsed * daysInMonth), mirroring the per-category
 * projection already in budgets.ts (`projectSpend`) but for the whole
 * household rather than one category. Returns null early in the month (days
 * 1-2), same reasoning budgets.ts uses for not projecting off almost no data,
 * and when there's simply nothing spent yet to extrapolate from.
 */
export async function getHouseholdForecast() {
  return runAction(async (): Promise<HouseholdForecast | null> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const today = getTodayISO();
    const month = getMonthRange(0);
    const daysElapsed = Number(today.split("-")[2]);
    const daysInMonth = Number(month.end.split("-")[2]);

    if (daysElapsed <= 2) return null; // too little of the month has passed for a projection to mean anything

    const { data, error } = await supabase.rpc("get_expense_summary", {
      p_household_id: householdId,
      p_start: month.start,
      p_end: today,
      p_paid_by: null,
    });
    if (error) throw new ActionError(error.message);

    const spentSoFar = Number(data?.[0]?.total ?? 0);
    const txnCount = data?.[0]?.txn_count ?? 0;
    if (txnCount === 0 || spentSoFar <= 0) return null; // nothing recorded yet this month to extrapolate from

    return {
      spentSoFar,
      projected: (spentSoFar / daysElapsed) * daysInMonth,
      daysElapsed,
      daysInMonth,
    };
  });
}

export interface SpendingChange {
  category_id: string;
  category_name: string;
  current: number;
  previous: number;
  changePct: number | null;
}

export interface SpendingChangesResult {
  changes: SpendingChange[];
  /** Neutral, factual one-liner naming where the money moved — never a claimed cause. */
  summary: string;
}

/**
 * Current month vs previous month, by category, top 5 movers by absolute
 * change. Returns null unless the previous month has real data to compare
 * against (spec: never compare against an empty/partial previous period).
 */
export async function getSpendingChanges() {
  return runAction(async (): Promise<SpendingChangesResult | null> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const current = getMonthRange(0);
    const previous = getPreviousMonthRange();

    const [currentRes, previousRes] = await Promise.all([
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: current.start, p_end: current.end, p_paid_by: null }),
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: previous.start, p_end: previous.end, p_paid_by: null }),
    ]);
    if (currentRes.error) throw new ActionError(currentRes.error.message);
    if (previousRes.error) throw new ActionError(previousRes.error.message);

    const previousRows = previousRes.data ?? [];
    const previousTotal = previousRows.reduce((sum, r) => sum + Number(r.total), 0);
    if (previousTotal <= 0) return null; // no full previous month of data to compare against

    const currentRows = currentRes.data ?? [];
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
    if (top5.every((c) => c.diff === 0)) return null; // nothing actually moved

    const changes: SpendingChange[] = top5.map(({ category_id, category_name, current: c, previous: p, changePct }) => ({
      category_id,
      category_name,
      current: c,
      previous: p,
      changePct,
    }));

    // Name where the money moved, never why — increases and decreases are described in strictly neutral terms.
    const topMover = top5[0];
    const sameDirection = (top5.some((c) => c.diff !== 0) ? top5 : []).filter((c) => Math.sign(c.diff) === Math.sign(topMover.diff) && c.diff !== 0);
    const names = sameDirection.slice(0, 2).map((c) => c.category_name);
    const namesLabel = names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
    const summary =
      topMover.diff > 0
        ? `Most of the increase came from ${namesLabel}.`
        : `Spending eased mainly in ${namesLabel}.`;

    return { changes, summary };
  });
}

export interface ItemPriceMemory {
  last: number;
  lastDate: string;
  typicalLow: number;
  typicalHigh: number;
  count: number;
}

/** Escapes Postgres ILIKE wildcards so a free-text item name is matched as a literal, case-insensitive string rather than a pattern. */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/**
 * Past purchase history for one item name (case-insensitive exact match),
 * based on the household's last up to 10 purchases of it. `typicalLow`/
 * `typicalHigh` are simply the min/max of that recent history — a
 * percentile would be more robust on a larger sample, but with at most 10
 * points min/max is simpler, easy to explain to the user ("between what
 * you've paid before"), and doesn't need an interpolation choice. Returns
 * null below 2 past purchases — too little to say anything meaningful.
 */
export async function getItemPriceMemory(itemName: string) {
  return runAction(async (): Promise<ItemPriceMemory | null> => {
    const trimmed = itemName.trim();
    if (!trimmed) return null;

    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("expenses")
      .select("amount, expense_date, created_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .ilike("item_name", escapeIlike(trimmed))
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new ActionError(error.message);

    const rows = data ?? [];
    if (rows.length < 2) return null;

    const amounts = rows.map((r) => Number(r.amount));
    return {
      last: amounts[0],
      lastDate: rows[0].expense_date,
      typicalLow: Math.min(...amounts),
      typicalHigh: Math.max(...amounts),
      count: rows.length,
    };
  });
}
