"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { getTodayISO, parseISODate } from "@/lib/date-utils";
import type { Tables } from "@/types/database";

// The `budgets` table (migration 001) and its RLS policy (migration 002) have
// existed since the very first migration - comment on the table literally
// says "architecture prepared now; UI can come later" - but no action or
// screen was ever built against it. This is that UI: monthly spending caps,
// per category or for the whole household, with progress against what's
// actually been spent (reusing the same `get_category_breakdown` RPC the
// Dashboard/Analytics screens already use - never a fresh raw query).

const budgetInputSchema = z.object({
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive("Enter an amount greater than 0"),
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/, "Invalid month"),
});

export type BudgetWithProgress = Tables<"budgets"> & {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  spent: number;
  /** Projected end-of-month spend (spent-so-far / days-elapsed * days-in-month), only set for the CURRENT month - a past month is already final and has nothing to project. */
  projectedSpend: number | null;
};

function monthBounds(periodMonth: string) {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = periodMonth;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of that month
  return { start, end };
}

export async function listBudgetsForMonth(periodMonth: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("household_id", householdId)
      .eq("period_month", periodMonth)
      .is("person_id", null) // person-level budgets aren't exposed in this first pass - see upsertBudget
      .order("created_at", { ascending: true });
    if (error) throw new ActionError(error.message);

    const { start, end } = monthBounds(periodMonth);
    const [{ data: breakdown }, { data: categories }] = await Promise.all([
      supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: start, p_end: end }),
      supabase.from("categories").select("id, name, icon, color"),
    ]);

    type BreakdownRow = { category_id: string; total: number | string };
    const rows = (breakdown ?? []) as BreakdownRow[];
    const spentMap = new Map(rows.map((b) => [b.category_id, Number(b.total)]));
    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
    const overallSpent = rows.reduce((sum, b) => sum + Number(b.total), 0);

    // Only project for the CURRENT month - a past month is already final, and a future
    // month has no "spent so far" to extrapolate from.
    const todayISO = getTodayISO(); // Asia/Kolkata "today", same convention as the rest of the app (spec section 38, 68)
    const isCurrentMonth = periodMonth === toPeriodMonth(parseISODate(todayISO));
    const daysInMonth = Number(end.split("-")[2]); // `end` is already the last calendar day of periodMonth (monthBounds)
    const daysElapsed = isCurrentMonth ? Number(todayISO.split("-")[2]) : 0;

    function projectSpend(spent: number): number | null {
      if (!isCurrentMonth || daysElapsed <= 0) return null;
      return (spent / daysElapsed) * daysInMonth;
    }

    const enriched: BudgetWithProgress[] = (budgets ?? []).map((b) => {
      const cat = b.category_id ? categoryMap.get(b.category_id) : null;
      const spent = b.category_id ? spentMap.get(b.category_id) ?? 0 : overallSpent;
      return {
        ...b,
        category_name: b.category_id ? cat?.name ?? "Deleted category" : "Overall household",
        category_icon: cat?.icon ?? null,
        category_color: cat?.color ?? null,
        spent,
        projectedSpend: projectSpend(spent),
      };
    });

    return enriched;
  });
}

/**
 * Creates or updates a budget for a category (or the whole household, when
 * `category_id` is null) for a given month. Deliberately does its own
 * find-then-write instead of `.upsert(..., { onConflict })`: the table's
 * unique constraint is `(household_id, category_id, person_id, period_month)`,
 * and Postgres never treats two NULLs as equal for uniqueness purposes - so
 * an `ON CONFLICT` on that constraint silently never fires while `person_id`
 * is NULL (our only supported case so far) and would insert duplicate rows
 * instead of updating the existing one.
 */
export async function upsertBudget(input: { category_id: string | null; amount: number; period_month: string }) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const parsed = budgetInputSchema.parse(input);

    let existing = supabase
      .from("budgets")
      .select("id")
      .eq("household_id", householdId)
      .eq("period_month", parsed.period_month)
      .is("person_id", null);
    existing = parsed.category_id ? existing.eq("category_id", parsed.category_id) : existing.is("category_id", null);
    const { data: existingRow } = await existing.maybeSingle();

    const { data, error } = existingRow
      ? await supabase.from("budgets").update({ amount: parsed.amount }).eq("id", existingRow.id).select().single()
      : await supabase
          .from("budgets")
          .insert({ household_id: householdId, category_id: parsed.category_id, person_id: null, period_month: parsed.period_month, amount: parsed.amount })
          .select()
          .single();

    if (error || !data) throw new ActionError(error?.message ?? "Couldn't save that budget");
    revalidatePath("/more/budgets");
    return data as Tables<"budgets">;
  });
}

export async function deleteBudget(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.from("budgets").delete().eq("id", id).eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/budgets");
    return { deleted: true };
  });
}
