"use server";

// "Analyze this expense" (spec section 2). Every number here is computed by
// Postgres/the existing breakdown functions — this file only assembles short,
// factual statements out of numbers that were already computed elsewhere; it
// never invents a narrative, and a line is simply omitted when the fact
// behind it can't be computed (no merchant, too little history, etc.) rather
// than guessed at. Same "AI explains/assists, never decides" discipline as
// lib/ai/insight-generator.ts and lib/ai/expense-parser.ts, except there's no
// AI involved at all here — every line is a plain arithmetic fact.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { detectPriceChange, type PriceChangeFlag } from "@/lib/actions/insights";
import { getMonthRange } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];

/** Escapes Postgres ILIKE wildcards so a free-text item name is matched literally (mirrors insights.ts). */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/** Calendar-month bounds (UTC) for the month that contains a given ISO date — like `date-utils.ts`'s `getMonthRange`, but anchored to an arbitrary date instead of "today minus N months", since an analyzed expense may not be from the current month. */
function monthRangeForDate(dateISO: string): { start: string; end: string } {
  const [y, m] = dateISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export interface CategoryShareFact {
  categoryName: string;
  expenseAmount: number;
  categoryMonthTotal: number;
  sharePct: number;
}

export interface MerchantComparisonFact {
  merchantName: string;
  thisAmount: number;
  /** Average of this merchant's transactions over the trailing 6 months (a fixed, documented window — not all-time, since a merchant's typical spend can drift). */
  merchantAvg: number;
  diffPct: number | null;
}

export interface MonthImpactFact {
  expenseAmount: number;
  monthTotal: number;
  sharePct: number;
}

export interface SimilarExpense {
  id: string;
  itemName: string;
  merchantName: string | null;
  amount: number;
  date: string;
}

export interface ExpenseAnalysis {
  categoryShare: CategoryShareFact | null;
  merchantComparison: MerchantComparisonFact | null;
  monthImpact: MonthImpactFact | null;
  similarExpenses: SimilarExpense[];
  priceChange: PriceChangeFlag | null;
}

export async function analyzeExpense(expenseId: string) {
  return runAction(async (): Promise<ExpenseAnalysis> => {
    const { supabase, householdId } = await requireHouseholdContext();

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("id, amount, item_name, category_id, merchant_id, expense_date")
      .eq("id", expenseId)
      .eq("household_id", householdId)
      .single();
    if (expenseError || !expense) throw new ActionError("Couldn't find that expense");

    const amount = Number(expense.amount);
    const expenseMonth = monthRangeForDate(expense.expense_date);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = getMonthRange(0);

    const merchantTrailingStart = getMonthRange(5).start; // trailing-6-month window ending today, for the merchant "typical" figure

    const [categoryRes, merchantRes, currentMonthSummaryRes, similarByItemRes, similarByMerchantRes, priceChangeRes] = await Promise.all([
      supabase.rpc("get_category_breakdown", {
        p_household_id: householdId,
        p_start: expenseMonth.start,
        p_end: expenseMonth.end,
        p_paid_by: null,
      }),
      expense.merchant_id
        ? supabase.rpc("get_merchant_breakdown", {
            p_household_id: householdId,
            p_start: merchantTrailingStart,
            p_end: today,
            p_limit: 200,
          })
        : Promise.resolve({ data: [] as MerchantBreakdownRow[], error: null }),
      supabase.rpc("get_expense_summary", {
        p_household_id: householdId,
        p_start: currentMonth.start,
        p_end: currentMonth.end,
        p_paid_by: null,
      }),
      supabase
        .from("expenses")
        .select("id, item_name, amount, expense_date, merchant_id")
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .neq("id", expenseId)
        .ilike("item_name", escapeIlike(expense.item_name.trim()))
        .order("expense_date", { ascending: false })
        .limit(5),
      expense.merchant_id
        ? supabase
            .from("expenses")
            .select("id, item_name, amount, expense_date, merchant_id")
            .eq("household_id", householdId)
            .eq("merchant_id", expense.merchant_id)
            .is("deleted_at", null)
            .neq("id", expenseId)
            .order("expense_date", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as { id: string; item_name: string; amount: string; expense_date: string; merchant_id: string | null }[], error: null }),
      detectPriceChange(expense.item_name),
    ]);

    if (categoryRes.error) throw new ActionError(categoryRes.error.message);
    if (merchantRes.error) throw new ActionError(merchantRes.error.message);
    if (currentMonthSummaryRes.error) throw new ActionError(currentMonthSummaryRes.error.message);
    if (similarByItemRes.error) throw new ActionError(similarByItemRes.error.message);
    if (similarByMerchantRes.error) throw new ActionError(similarByMerchantRes.error.message);

    // Category share of this expense's own month.
    const categoryRow = (categoryRes.data as CategoryBreakdownRow[] | null)?.find((r) => r.category_id === expense.category_id);
    const categoryMonthTotal = categoryRow ? Number(categoryRow.total) : 0;
    const categoryShare: CategoryShareFact | null =
      categoryRow && categoryMonthTotal > 0
        ? { categoryName: categoryRow.category_name, expenseAmount: amount, categoryMonthTotal, sharePct: (amount / categoryMonthTotal) * 100 }
        : null;

    // Merchant comparison (trailing 6 months), only when a merchant is set.
    let merchantComparison: MerchantComparisonFact | null = null;
    if (expense.merchant_id) {
      const merchantRow = (merchantRes.data as MerchantBreakdownRow[] | null)?.find((r) => r.merchant_id === expense.merchant_id);
      if (merchantRow) {
        const merchantAvg = Number(merchantRow.avg_transaction);
        merchantComparison = {
          merchantName: merchantRow.merchant_name,
          thisAmount: amount,
          merchantAvg,
          diffPct: merchantAvg > 0 ? ((amount - merchantAvg) / merchantAvg) * 100 : null,
        };
      }
    }

    // Impact on the current calendar month's total — only meaningful when this expense actually falls in the current month.
    const monthTotal = Number(currentMonthSummaryRes.data?.[0]?.total ?? 0);
    const monthImpact: MonthImpactFact | null =
      expense.expense_date >= currentMonth.start && expense.expense_date <= currentMonth.end && monthTotal > 0
        ? { expenseAmount: amount, monthTotal, sharePct: (amount / monthTotal) * 100 }
        : null;

    // Similar previous expenses: same item name, plus same merchant, deduped and capped at 5, most recent first.
    const byId = new Map<string, SimilarExpense>();
    for (const row of [...(similarByItemRes.data ?? []), ...(similarByMerchantRes.data ?? [])]) {
      if (!byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          itemName: row.item_name,
          merchantName: null, // name lookup isn't needed for this short list — the item name / date / amount already give useful context
          amount: Number(row.amount),
          date: row.expense_date,
        });
      }
    }
    const similarExpenses = Array.from(byId.values())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5);

    return {
      categoryShare,
      merchantComparison,
      monthImpact,
      similarExpenses,
      priceChange: priceChangeRes.error === null ? priceChangeRes.data : null,
    };
  });
}
