"use server";

// "Ask GharKharch" - the full pipeline from spec sections 46-47:
//   User question -> Intent detection -> Safe query builder -> Database
//   aggregation -> Structured result -> AI explanation
// This is the only file that runs stage 3 (it calls the same SQL analytics
// RPCs the Dashboard/Analytics screens use - never a raw, unscoped query),
// and it is the only place stage 1-2 (lib/ai/financial-query.ts) and stage
// 4-5 (lib/ai/insight-generator.ts) meet. The `facts` object returned
// alongside the narration is exactly what was given to the AI to explain -
// surfacing it in the UI lets the user verify the AI didn't add anything.

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { getRecurringSummary } from "@/lib/actions/recurring";
import { detectIntent, type QueryIntent } from "@/lib/ai/financial-query";
import { explainFinancialAnswer, type AiAnswer } from "@/lib/ai/insight-generator";
import { getPreviousComparableRange } from "@/lib/date-utils";
import { formatINR } from "@/lib/utils";

export interface AskGharKharchResult {
  answer: AiAnswer;
  facts: unknown;
  intent: QueryIntent["type"];
}

const UNKNOWN_ANSWER =
  "I couldn't quite work out what you're asking. Try something like \"How much did I spend this month?\", \"What's my top category this month?\", or \"How much on Zomato last month?\"";

export async function askGharKharch(question: string) {
  return runAction(async (): Promise<AskGharKharchResult> => {
    const trimmed = question.trim();
    if (!trimmed) throw new ActionError("Ask a question first");

    const { supabase, householdId } = await requireHouseholdContext();

    const [categoriesResult, merchantsResult, patternsRes] = await Promise.all([
      listCategoriesForHousehold(),
      listMerchantsForHousehold(),
      supabase
        .from("expense_patterns")
        .select("item_name, average_amount, usage_count")
        .eq("household_id", householdId)
        .not("item_name", "is", null)
        .order("usage_count", { ascending: false })
        .limit(30),
    ]);

    if (!categoriesResult.data) throw new ActionError(categoriesResult.error ?? "Couldn't load categories");
    if (!merchantsResult.data) throw new ActionError(merchantsResult.error ?? "Couldn't load merchants");

    const categoryNames = categoriesResult.data.flat.map((c) => c.name);
    const merchantNames = merchantsResult.data.map((m) => m.name);
    const namedPatterns = (patternsRes.data ?? []).filter((p): p is typeof p & { item_name: string } => p.item_name !== null);
    const frequentItemNames = Array.from(new Set(namedPatterns.map((p) => p.item_name)));

    const intent = detectIntent(trimmed, { categoryNames, merchantNames, frequentItemNames });

    if (intent.type === "unknown") {
      return { answer: { text: UNKNOWN_ANSWER, source: "deterministic" }, facts: null, intent: "unknown" };
    }

    const { deterministicAnswer, facts } = await resolveIntent(intent, { supabase, householdId, namedPatterns });
    const answer = await explainFinancialAnswer(trimmed, facts, deterministicAnswer);
    return { answer, facts, intent: intent.type };
  });
}

async function resolveIntent(
  intent: Exclude<QueryIntent, { type: "unknown" }>,
  ctx: {
    supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
    householdId: string;
    namedPatterns: { item_name: string; average_amount: string | null; usage_count: number }[];
  },
): Promise<{ deterministicAnswer: string; facts: unknown }> {
  const { supabase, householdId } = ctx;

  switch (intent.type) {
    case "total_spending": {
      const { data, error } = await supabase.rpc("get_expense_summary", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
      });
      if (error) throw new ActionError(error.message);
      const total = Number(data?.[0]?.total ?? 0);
      const txnCount = data?.[0]?.txn_count ?? 0;
      return {
        deterministicAnswer: `You've spent ${formatINR(total)} ${intent.periodLabel} across ${txnCount} transaction${txnCount === 1 ? "" : "s"}.`,
        facts: { period: intent.periodLabel, total, txnCount },
      };
    }

    case "category_spending": {
      const { data, error } = await supabase.rpc("get_category_breakdown", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
      });
      if (error) throw new ActionError(error.message);
      const row = (data ?? []).find((r) => r.category_name.toLowerCase() === intent.categoryName.toLowerCase());
      const total = row ? Number(row.total) : 0;
      return {
        deterministicAnswer: row
          ? `You've spent ${formatINR(total)} on ${intent.categoryName} ${intent.periodLabel}.`
          : `No spending found in ${intent.categoryName} ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, categoryName: intent.categoryName, total, txnCount: row?.txn_count ?? 0 },
      };
    }

    case "category_income": {
      const { data, error } = await supabase.rpc("get_income_summary", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
      });
      if (error) throw new ActionError(error.message);
      const row = (data ?? []).find((r) => r.category_name.toLowerCase() === intent.categoryName.toLowerCase());
      const total = row ? Number(row.total) : 0;
      const count = row ? Number(row.txn_count) : 0;
      return {
        deterministicAnswer: row
          ? `LuxeKraft / your household received ${formatINR(total)} in revenue from ${intent.categoryName} ${intent.periodLabel} across ${count} transaction${count === 1 ? "" : "s"}.`
          : `No income or sales recorded for ${intent.categoryName} ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, categoryName: intent.categoryName, total, txnCount: count },
      };
    }

    case "merchant_spending": {
      const { data, error } = await supabase.rpc("get_merchant_breakdown", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
        p_limit: 50,
      });
      if (error) throw new ActionError(error.message);
      const row = (data ?? []).find((r) => r.merchant_name.toLowerCase() === intent.merchantName.toLowerCase());
      const total = row ? Number(row.total) : 0;
      return {
        deterministicAnswer: row
          ? `You've spent ${formatINR(total)} at ${intent.merchantName} ${intent.periodLabel}.`
          : `No spending found at ${intent.merchantName} ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, merchantName: intent.merchantName, total, txnCount: row?.txn_count ?? 0 },
      };
    }

    case "top_category": {
      const { data, error } = await supabase.rpc("get_category_breakdown", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
      });
      if (error) throw new ActionError(error.message);
      const sorted = [...(data ?? [])].sort((a, b) => Number(b.total) - Number(a.total));
      const top = sorted[0] ?? null;
      return {
        deterministicAnswer: top
          ? `Your top category ${intent.periodLabel} is ${top.category_name}, at ${formatINR(Number(top.total))}.`
          : `No spending recorded ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, topCategory: top ? { name: top.category_name, total: Number(top.total) } : null },
      };
    }

    case "top_merchant": {
      const { data, error } = await supabase.rpc("get_merchant_breakdown", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
        p_limit: 50,
      });
      if (error) throw new ActionError(error.message);
      const sorted = [...(data ?? [])].sort((a, b) => Number(b.total) - Number(a.total));
      const top = sorted[0] ?? null;
      return {
        deterministicAnswer: top
          ? `Your top merchant ${intent.periodLabel} is ${top.merchant_name}, at ${formatINR(Number(top.total))}.`
          : `No merchant spending recorded ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, topMerchant: top ? { name: top.merchant_name, total: Number(top.total) } : null },
      };
    }

    case "item_average": {
      // expense_patterns rows are already per-item aggregates (spec section
      // 88: never re-derive an average from raw expense rows in JS when the
      // DB already tracks one) - one item can span several merchants/
      // categories, so combine them with a usage-weighted average.
      const rows = ctx.namedPatterns.filter((p) => p.item_name.toLowerCase() === intent.itemName.toLowerCase());
      const totalUsage = rows.reduce((sum, r) => sum + r.usage_count, 0);
      const weightedAvg = totalUsage > 0 ? rows.reduce((sum, r) => sum + Number(r.average_amount ?? 0) * r.usage_count, 0) / totalUsage : 0;
      return {
        deterministicAnswer:
          totalUsage > 0
            ? `You typically spend around ${formatINR(weightedAvg)} on ${intent.itemName}, based on ${totalUsage} past purchase${totalUsage === 1 ? "" : "s"}.`
            : `Not enough history yet to average ${intent.itemName}.`,
        facts: { itemName: intent.itemName, averageAmount: weightedAvg, sampleSize: totalUsage },
      };
    }

    case "most_frequent_items": {
      // get_item_analytics is already ordered by usage internally (spec
      // section 88: never re-derive this in JS) - sort defensively by
      // txn_count here too since the RPC's contract doesn't promise an order.
      const { data, error } = await supabase.rpc("get_item_analytics", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
        p_limit: intent.limit,
      });
      if (error) throw new ActionError(error.message);
      const sorted = [...(data ?? [])].sort((a, b) => b.txn_count - a.txn_count).slice(0, intent.limit);
      const list = sorted.map((r) => `${r.item_name} (${r.txn_count}x)`).join(", ");
      return {
        deterministicAnswer:
          sorted.length > 0
            ? `Your ${sorted.length} most frequent expense${sorted.length === 1 ? "" : "s"} ${intent.periodLabel} ${sorted.length === 1 ? "is" : "are"}: ${list}.`
            : `No expenses recorded ${intent.periodLabel}.`,
        facts: { period: intent.periodLabel, items: sorted.map((r) => ({ name: r.item_name, txnCount: r.txn_count, total: Number(r.total) })) },
      };
    }

    case "amount_threshold": {
      // No existing analytics RPC filters by amount, so this queries
      // `expenses` directly - still fully household- and RLS-scoped via the
      // same `supabase` client every other action here uses, never a raw
      // unscoped query.
      let query = supabase
        .from("expenses")
        .select("id, item_name, amount, expense_date")
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .gte("expense_date", intent.period.start)
        .lte("expense_date", intent.period.end);
      query = intent.direction === "above" ? query.gt("amount", intent.amount) : query.lt("amount", intent.amount);
      const { data, error } = await query.order("amount", { ascending: false }).limit(50);
      if (error) throw new ActionError(error.message);
      const rows = data ?? [];
      const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
      return {
        deterministicAnswer:
          rows.length > 0
            ? `${rows.length} expense${rows.length === 1 ? "" : "s"} ${intent.direction} ${formatINR(intent.amount)} ${intent.periodLabel}, totaling ${formatINR(total)}.`
            : `No expenses ${intent.direction} ${formatINR(intent.amount)} ${intent.periodLabel}.`,
        facts: {
          period: intent.periodLabel,
          direction: intent.direction,
          threshold: intent.amount,
          count: rows.length,
          total,
          items: rows.slice(0, 10).map((r) => ({ name: r.item_name, amount: Number(r.amount), date: r.expense_date })),
        },
      };
    }

    case "recurring_list": {
      const summaryResult = await getRecurringSummary();
      if (summaryResult.error !== null) throw new ActionError(summaryResult.error);
      const active = summaryResult.data.upcoming;
      const names = active.map((r) => `${r.name} (${formatINR(r.amount)}/${r.frequency})`).join(", ");
      return {
        deterministicAnswer:
          active.length > 0
            ? `You have ${active.length} active recurring expense${active.length === 1 ? "" : "s"}: ${names}. That's about ${formatINR(summaryResult.data.monthlyTotal)}/month.`
            : "You don't have any active recurring expenses set up yet.",
        facts: {
          monthlyTotal: summaryResult.data.monthlyTotal,
          recurring: active.map((r) => ({ name: r.name, amount: Number(r.amount), frequency: r.frequency, nextDueDate: r.next_due_date })),
        },
      };
    }

    case "business_pnl": {
      const { data, error } = await supabase.rpc("get_business_pnl", {
        p_household_id: householdId,
        p_start: intent.period.start,
        p_end: intent.period.end,
      });
      if (error) throw new ActionError(error.message);
      const row = data?.[0];
      const incomeTotal = Number(row?.income_total ?? 0);
      const expenseTotal = Number(row?.expense_total ?? 0);
      const netProfit = Number(row?.net_profit ?? 0);
      const margin = incomeTotal > 0 ? ((netProfit / incomeTotal) * 100).toFixed(1) : "0";
      const answer =
        netProfit >= 0
          ? `Your Homemade Business earned +${formatINR(incomeTotal)} in revenue against -${formatINR(expenseTotal)} in operating expenses ${intent.periodLabel}, generating a net profit of +${formatINR(netProfit)} (${margin}% net margin).`
          : `Your Homemade Business had -${formatINR(expenseTotal)} in expenses and +${formatINR(incomeTotal)} in revenue ${intent.periodLabel}, resulting in a net loss of -${formatINR(Math.abs(netProfit))}.`;
      return {
        deterministicAnswer: answer,
        facts: {
          period: intent.periodLabel,
          businessRevenue: incomeTotal,
          businessExpenses: expenseTotal,
          netProfit,
          profitMarginPercent: margin,
          incomeTxnCount: Number(row?.income_count ?? 0),
          expenseTxnCount: Number(row?.expense_count ?? 0),
        },
      };
    }

    case "total_income": {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, item_name, amount, category_id, expense_date")
        .eq("household_id", householdId)
        .eq("entry_type", "income")
        .is("deleted_at", null)
        .gte("expense_date", intent.period.start)
        .lte("expense_date", intent.period.end);
      if (error) throw new ActionError(error.message);
      const rows = data ?? [];
      const totalIncome = rows.reduce((sum, r) => sum + Number(r.amount), 0);
      return {
        deterministicAnswer:
          rows.length > 0
            ? `Your household received +${formatINR(totalIncome)} in total earnings and inflows ${intent.periodLabel} across ${rows.length} transaction${rows.length === 1 ? "" : "s"}.`
            : `No income or inflows recorded ${intent.periodLabel}.`,
        facts: {
          period: intent.periodLabel,
          totalInflow: totalIncome,
          transactionCount: rows.length,
          topSources: rows.slice(0, 5).map((r) => ({ item: r.item_name, amount: Number(r.amount), date: r.expense_date })),
        },
      };
    }

    case "person_spending": {
      const [membersRes, breakdownRes] = await Promise.all([
        supabase.from("household_members").select("user_id, role"),
        supabase.rpc("get_person_breakdown", {
          p_household_id: householdId,
          p_start: intent.period.start,
          p_end: intent.period.end,
        }),
      ]);
      if (breakdownRes.error) throw new ActionError(breakdownRes.error.message);
      const personBreakdown = breakdownRes.data ?? [];
      const list = personBreakdown.map((p) => `- Person ${p.paid_by.slice(0, 6)}: ${formatINR(Number(p.total))} (${p.txn_count} txns)`).join(", ");
      return {
        deterministicAnswer:
          personBreakdown.length > 0
            ? `Household spending breakdown ${intent.periodLabel}: ${list}.`
            : `No spending records found ${intent.periodLabel}.`,
        facts: {
          period: intent.periodLabel,
          personBreakdown: personBreakdown.map((p) => ({ id: p.paid_by, total: Number(p.total), txnCount: p.txn_count })),
        },
      };
    }

    case "general_financial": {
      const [summaryRes, categoryRes, merchantRes, pnlRes, incomesRes] = await Promise.all([
        supabase.rpc("get_expense_summary", {
          p_household_id: householdId,
          p_start: intent.period.start,
          p_end: intent.period.end,
        }),
        supabase.rpc("get_category_breakdown", {
          p_household_id: householdId,
          p_start: intent.period.start,
          p_end: intent.period.end,
        }),
        supabase.rpc("get_merchant_breakdown", {
          p_household_id: householdId,
          p_start: intent.period.start,
          p_end: intent.period.end,
          p_limit: 5,
        }),
        supabase.rpc("get_business_pnl", {
          p_household_id: householdId,
          p_start: intent.period.start,
          p_end: intent.period.end,
        }),
        supabase
          .from("expenses")
          .select("amount")
          .eq("household_id", householdId)
          .eq("entry_type", "income")
          .is("deleted_at", null)
          .gte("expense_date", intent.period.start)
          .lte("expense_date", intent.period.end),
      ]);

      const totalSpent = Number(summaryRes.data?.[0]?.total ?? 0);
      const incomeRows = incomesRes.data ?? [];
      const totalEarned = incomeRows.reduce((sum, r) => sum + Number(r.amount), 0);
      const topCategories = (categoryRes.data ?? []).slice(0, 4).map((c) => `${c.category_name} (${formatINR(Number(c.total))})`).join(", ");
      const pnlRow = pnlRes.data?.[0];
      const netProfit = Number(pnlRow?.net_profit ?? 0);

      const answer = `Summary for ${intent.periodLabel}: Total spent is ${formatINR(totalSpent)} across ${summaryRes.data?.[0]?.txn_count ?? 0} expenses. Total inflows are +${formatINR(totalEarned)}. Top categories: ${topCategories || "None"}.${pnlRow ? ` Business net profit: ${netProfit >= 0 ? "+" : ""}${formatINR(netProfit)}.` : ""}`;

      return {
        deterministicAnswer: answer,
        facts: {
          period: intent.periodLabel,
          totalExpense: totalSpent,
          totalIncome: totalEarned,
          netBalance: totalEarned - totalSpent,
          topCategories: (categoryRes.data ?? []).slice(0, 5).map((c) => ({ name: c.category_name, total: Number(c.total) })),
          topMerchants: (merchantRes.data ?? []).slice(0, 5).map((m) => ({ name: m.merchant_name, total: Number(m.total) })),
          businessPnl: pnlRow ? { revenue: Number(pnlRow.income_total), expenses: Number(pnlRow.expense_total), netProfit } : null,
        },
      };
    }

    case "biggest_category_change": {
      const previousRange = getPreviousComparableRange(intent.period);
      const [currentRes, previousRes] = await Promise.all([
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: intent.period.start, p_end: intent.period.end }),
        supabase.rpc("get_category_breakdown", { p_household_id: householdId, p_start: previousRange.start, p_end: previousRange.end }),
      ]);
      if (currentRes.error) throw new ActionError(currentRes.error.message);
      if (previousRes.error) throw new ActionError(previousRes.error.message);

      const previousByName = new Map((previousRes.data ?? []).map((r) => [r.category_name, Number(r.total)]));
      const deltas = (currentRes.data ?? []).map((r) => {
        const previous = previousByName.get(r.category_name) ?? 0;
        return { name: r.category_name, current: Number(r.total), previous, delta: Number(r.total) - previous };
      });
      deltas.sort((a, b) => b.delta - a.delta);
      const biggest = deltas[0] ?? null;

      return {
        deterministicAnswer:
          biggest && biggest.delta > 0
            ? `${biggest.name} rose the most, up ${formatINR(biggest.delta)} vs the previous period (${formatINR(biggest.previous)} -> ${formatINR(biggest.current)}).`
            : `No category increased vs the previous period.`,
        facts: { period: intent.periodLabel, biggestIncrease: biggest },
      };
    }

    default: {
      const anyIntent = intent as any;
      const fallbackPeriod = anyIntent?.period ?? {
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      };
      const fallbackLabel = anyIntent?.periodLabel ?? "this month";
      const { data, error } = await supabase.rpc("get_expense_summary", {
        p_household_id: householdId,
        p_start: fallbackPeriod.start,
        p_end: fallbackPeriod.end,
      });
      if (error) throw new ActionError(error.message);
      const total = Number(data?.[0]?.total ?? 0);
      const txnCount = data?.[0]?.txn_count ?? 0;
      return {
        deterministicAnswer: `You've spent ${formatINR(total)} ${fallbackLabel} across ${txnCount} transactions.`,
        facts: { period: fallbackLabel, total, txnCount },
      };
    }
  }
}
