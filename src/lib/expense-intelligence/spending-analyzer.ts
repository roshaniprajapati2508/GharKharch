// Insights Engine (spec section 30). Every insight here is derived directly
// from numbers GharKharch already aggregates in Postgres — nothing is
// invented, and an insight is simply omitted when the underlying data isn't
// meaningful yet (e.g. no previous-period total to compare against).

import { formatINR, percentChange } from "@/lib/utils";
import { checkAnomaly } from "@/lib/expense-intelligence/anomaly-detector";
import type { Database } from "@/types/database";
import type { DateRange } from "@/lib/date-utils";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];
type TopExpenseRow = Database["public"]["Functions"]["get_top_expenses"]["Returns"][number];

export interface Insight {
  id: string;
  text: string;
  tone: "positive" | "neutral" | "attention";
}

export interface InsightsInput {
  range: DateRange;
  previousRange: DateRange;
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categoryBreakdown: CategoryBreakdownRow[];
  previousCategoryBreakdown: CategoryBreakdownRow[];
  merchantBreakdown: MerchantBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
  dailySpending: DailySpendingRow[];
  topExpenses: TopExpenseRow[];
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function generateInsights(input: InsightsInput): Insight[] {
  const insights: Insight[] = [];
  const total = parseFloat(input.summary.total);
  const prevTotal = parseFloat(input.previousSummary.total);

  // 1. Household-level comparison
  if (prevTotal > 0) {
    const change = percentChange(total, prevTotal);
    if (change !== null && Math.abs(change) >= 3) {
      insights.push({
        id: "household-comparison",
        text: `Your household spent ${Math.abs(change).toFixed(0)}% ${change < 0 ? "less" : "more"} in ${input.range.label.toLowerCase()} than ${input.previousRange.label.toLowerCase()}.`,
        tone: change < 0 ? "positive" : "neutral",
      });
    }
  }

  // 2. Biggest category mover
  const prevCatMap = new Map(input.previousCategoryBreakdown.map((c) => [c.category_id, parseFloat(c.total)]));
  const categoryMoves = input.categoryBreakdown
    .map((c) => ({ name: c.category_name, current: parseFloat(c.total), previous: prevCatMap.get(c.category_id) ?? 0 }))
    .filter((c) => c.previous > 0)
    .map((c) => ({ ...c, delta: c.current - c.previous }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMove = categoryMoves[0];
  if (topMove && Math.abs(topMove.delta) >= 100) {
    insights.push({
      id: "category-mover",
      text: `You spent ${formatINR(Math.abs(topMove.delta))} ${topMove.delta > 0 ? "more" : "less"} on ${topMove.name} this period than last.`,
      tone: topMove.delta > 0 ? "neutral" : "positive",
    });
  }

  // 3. Most frequent item
  const topItem = input.itemAnalytics[0];
  if (topItem && topItem.txn_count >= 2) {
    insights.push({
      id: "frequent-item",
      text: `${topItem.item_name.charAt(0).toUpperCase()}${topItem.item_name.slice(1)} is your most frequent expense this period, bought ${topItem.txn_count} times.`,
      tone: "neutral",
    });
  }

  // 4. Average daily spending
  if (input.summary.days > 0 && total > 0) {
    insights.push({
      id: "daily-average",
      text: `Your average daily spending is ${formatINR(total / input.summary.days)}.`,
      tone: "neutral",
    });
  }

  // 5. Highest-spending weekday
  if (input.dailySpending.length >= 7) {
    const byWeekday = new Map<number, number>();
    for (const d of input.dailySpending) {
      const weekday = new Date(`${d.expense_date}T00:00:00Z`).getUTCDay();
      byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + parseFloat(d.total));
    }
    const [topWeekday, topWeekdayTotal] = Array.from(byWeekday.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (topWeekday !== null && topWeekdayTotal > 0) {
      insights.push({
        id: "highest-weekday",
        text: `${WEEKDAY_NAMES[topWeekday]} is your highest-spending day.`,
        tone: "neutral",
      });
    }
  }

  // 6. Top merchant concentration
  const topMerchant = input.merchantBreakdown[0];
  if (topMerchant && total > 0) {
    const pct = (parseFloat(topMerchant.total) / total) * 100;
    if (pct >= 10) {
      insights.push({
        id: "merchant-concentration",
        text: `${topMerchant.merchant_name} accounts for ${pct.toFixed(0)}% of your spending this period.`,
        tone: "neutral",
      });
    }
  }

  // 7. Anomalies among the period's top expenses
  const merchantMap = new Map(input.merchantBreakdown.map((m) => [m.merchant_id, m]));
  const categoryMap = new Map(input.categoryBreakdown.map((c) => [c.category_id, c]));
  for (const expense of input.topExpenses.slice(0, 5)) {
    const merchant = expense.merchant_id ? merchantMap.get(expense.merchant_id) : null;
    const category = categoryMap.get(expense.category_id);
    const anomaly = checkAnomaly(
      {
        itemName: expense.item_name,
        amount: parseFloat(expense.amount),
        merchantName: merchant?.merchant_name ?? null,
        merchantAvg: merchant ? parseFloat(merchant.avg_transaction) : null,
        merchantHighest: merchant ? parseFloat(merchant.highest_transaction) : null,
        categoryName: category?.category_name ?? null,
        categoryAvg: category ? parseFloat(category.avg_transaction) : null,
        categoryHighest: category ? parseFloat(category.highest_transaction) : null,
      },
      merchant?.txn_count ?? category?.txn_count ?? 0
    );
    if (anomaly) {
      insights.push({ id: `anomaly-${expense.id}`, text: anomaly.message, tone: "attention" });
    }
  }

  return insights;
}
