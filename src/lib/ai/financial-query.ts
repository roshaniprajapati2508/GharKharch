// "Ask GharKharch" query pipeline, stage 1-2 (spec section 46, 47):
//   User question -> Intent detection -> Safe query builder
// Both stages here are pure, deterministic, and keyword-based — no LLM call
// happens until the very end (lib/ai/insight-generator.ts), and this file
// never touches the database itself. The actual DB aggregation (stage 3) runs
// in actions/ai-assistant.ts, calling the same RPC functions the
// Analytics/Dashboard screens already use — never a raw, unscoped query.

import { getMonthRange, getPreviousMonthRange, getYearRange, getTodayRange, getWeekRange, type DateRange } from "@/lib/date-utils";

export type QueryIntent =
  | { type: "total_spending"; period: DateRange; periodLabel: string }
  | { type: "category_spending"; categoryName: string; period: DateRange; periodLabel: string }
  | { type: "merchant_spending"; merchantName: string; period: DateRange; periodLabel: string }
  | { type: "top_category"; period: DateRange; periodLabel: string }
  | { type: "top_merchant"; period: DateRange; periodLabel: string }
  | { type: "item_average"; itemName: string }
  | { type: "biggest_category_change"; period: DateRange; periodLabel: string }
  | { type: "unknown" };

function detectPeriod(question: string): { range: DateRange; label: string } {
  const q = question.toLowerCase();
  if (q.includes("today")) return { range: getTodayRange(), label: "today" };
  if (q.includes("this week")) return { range: getWeekRange(), label: "this week" };
  if (q.includes("last month")) return { range: getPreviousMonthRange(), label: "last month" };
  if (q.includes("this year") || q.includes("this year")) return { range: getYearRange(0), label: "this year" };
  if (q.includes("this month")) return { range: getMonthRange(0), label: "this month" };
  return { range: getMonthRange(0), label: "this month" }; // sensible default rather than refusing to answer
}

/**
 * Matches a known name (category or merchant) inside free text. Longer names
 * are checked first so "Food & Grocery" wins over a shorter partial overlap.
 */
function findKnownName(question: string, names: string[]): string | null {
  const q = question.toLowerCase();
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (name.length >= 3 && q.includes(name.toLowerCase())) return name;
  }
  return null;
}

export interface IntentContext {
  categoryNames: string[];
  merchantNames: string[];
  frequentItemNames: string[];
}

export function detectIntent(question: string, ctx: IntentContext): QueryIntent {
  const q = question.toLowerCase();
  const { range, label } = detectPeriod(question);

  if (/which categor(y|ies).*(increas|grow|went up)/.test(q) || /biggest.*(increase|change)/.test(q)) {
    return { type: "biggest_category_change", period: range, periodLabel: label };
  }

  if (/(top|biggest|most|highest).*categor/.test(q)) {
    return { type: "top_category", period: range, periodLabel: label };
  }

  if (/(top|biggest|most|favou?rite).*merchant/.test(q)) {
    return { type: "top_merchant", period: range, periodLabel: label };
  }

  const merchantName = findKnownName(question, ctx.merchantNames);
  if (merchantName && /spend|spent|spending/.test(q)) {
    return { type: "merchant_spending", merchantName, period: range, periodLabel: label };
  }

  const categoryName = findKnownName(question, ctx.categoryNames);
  if (categoryName && /spend|spent|spending/.test(q)) {
    return { type: "category_spending", categoryName, period: range, periodLabel: label };
  }

  const itemName = findKnownName(question, ctx.frequentItemNames);
  if (itemName && /(average|approx|every month|per month|how much.*on)/.test(q)) {
    return { type: "item_average", itemName };
  }

  if (/how much.*(spend|spent|spending)/.test(q)) {
    return { type: "total_spending", period: range, periodLabel: label };
  }

  return { type: "unknown" };
}
