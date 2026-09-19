// "Ask GharKharch" query pipeline, stage 1-2 (spec section 46, 47):
//   User question -> Intent detection -> Safe query builder
// Both stages here are pure, deterministic, and keyword-based — no LLM call
// happens until the very end (lib/ai/insight-generator.ts), and this file
// never touches the database itself. The actual DB aggregation (stage 3) runs
// in actions/ai-assistant.ts, calling the same RPC functions the
// Analytics/Dashboard screens already use — never a raw, unscoped query.

import {
  getMonthRange,
  getPreviousMonthRange,
  getYearRange,
  getTodayRange,
  getWeekRange,
  getTodayISO,
  addDaysISO,
  parseISODate,
  type DateRange,
} from "@/lib/date-utils";

export type QueryIntent =
  | { type: "total_spending"; period: DateRange; periodLabel: string }
  | { type: "total_income"; period: DateRange; periodLabel: string }
  | { type: "business_pnl"; period: DateRange; periodLabel: string }
  | { type: "person_spending"; personName: string; period: DateRange; periodLabel: string }
  | { type: "category_spending"; categoryName: string; period: DateRange; periodLabel: string }
  | { type: "merchant_spending"; merchantName: string; period: DateRange; periodLabel: string }
  | { type: "top_category"; period: DateRange; periodLabel: string }
  | { type: "top_merchant"; period: DateRange; periodLabel: string }
  | { type: "item_average"; itemName: string }
  | { type: "biggest_category_change"; period: DateRange; periodLabel: string }
  | { type: "most_frequent_items"; period: DateRange; periodLabel: string; limit: number }
  | { type: "amount_threshold"; direction: "above" | "below"; amount: number; period: DateRange; periodLabel: string }
  | { type: "recurring_list" }
  | { type: "general_financial"; period: DateRange; periodLabel: string }
  | { type: "unknown" };

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Resolves "last <weekday>" (e.g. "last Sunday") to that specific past date — always strictly before today, even when today itself is that weekday. */
function resolveLastWeekday(question: string): { range: DateRange; label: string } | null {
  const q = question.toLowerCase();
  const match = WEEKDAY_NAMES.find((day) => q.includes(`last ${day}`));
  if (!match) return null;

  const todayIso = getTodayISO();
  const targetDow = WEEKDAY_NAMES.indexOf(match);
  const todayDow = parseISODate(todayIso).getUTCDay();
  let daysAgo = (todayDow - targetDow + 7) % 7;
  if (daysAgo === 0) daysAgo = 7; // "last Sunday" on a Sunday means the previous one, not today
  const date = addDaysISO(todayIso, -daysAgo);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  return { range: { start: date, end: date, label }, label: `on ${label}` };
}

/** Parses "last N months"/"last N month" (falls back to the fixed today/week/month/year buckets otherwise, then "last month" -> N=1 already handled by the exact-phrase check above it). */
function resolveLastNMonths(question: string): { range: DateRange; label: string } | null {
  const match = question.toLowerCase().match(/last (\d+) months?/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;

  const end = getTodayISO();
  const today = parseISODate(end);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n + 1, 1)).toISOString().slice(0, 10);
  return { range: { start, end, label: `Last ${n} months` }, label: `over the last ${n} months` };
}

function detectPeriod(question: string): { range: DateRange; label: string } {
  const q = question.toLowerCase();

  const lastWeekday = resolveLastWeekday(q);
  if (lastWeekday) return lastWeekday;

  const lastNMonths = resolveLastNMonths(q);
  if (lastNMonths) return lastNMonths;

  if (q.includes("today")) return { range: getTodayRange(), label: "today" };
  if (q.includes("this week")) return { range: getWeekRange(), label: "this week" };
  if (q.includes("last month")) return { range: getPreviousMonthRange(), label: "last month" };
  if (q.includes("this year")) return { range: getYearRange(0), label: "this year" };
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

/** Extracts a rupee amount from "above/over/more than 5000" or "below/under/less than ₹5,000" phrasing — strips ₹, commas and "rs"/"rupees" before parsing. */
function parseAmountThreshold(question: string): { amount: number; direction: "above" | "below" } | null {
  const q = question.toLowerCase();
  const amountMatch = q.match(/(?:₹|rs\.?|rupees)?\s*([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees)?/);
  const aboveWords = /(above|over|more than|greater than|exceeding)/.test(q);
  const belowWords = /(below|under|less than|smaller than)/.test(q);
  if (!amountMatch || (!aboveWords && !belowWords)) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, direction: aboveWords ? "above" : "below" };
}

export function detectIntent(question: string, ctx: IntentContext): QueryIntent {
  const q = question.toLowerCase();
  const { range, label } = detectPeriod(question);

  // Business P&L / Homemade Business
  if (/(business|pnl|p&l|profit|margin|luxekraft|mehndi business|homemade business|store profit)/.test(q)) {
    return { type: "business_pnl", period: range, periodLabel: label };
  }

  // Total Income / Inflows / Earnings
  if (/(income|earn|earned|earning|inflow|salary|payout|sales|received|deposit)/.test(q) && !/(expense|spend|spent)/.test(q)) {
    return { type: "total_income", period: range, periodLabel: label };
  }

  // Person spending (e.g. "How much did Harsh spend?" or "How much did Roshni spend?")
  if (/(harsh|roshni|partner|you|who spent|spend comparison)/.test(q)) {
    const personName = /roshni/.test(q) ? "Roshni" : /harsh/.test(q) ? "Harsh" : "household";
    return { type: "person_spending", personName, period: range, periodLabel: label };
  }

  if (/recurring/.test(q) && /(what|which|list|show).*recurring|recurring.*(expenses|bills|payments)/.test(q)) {
    return { type: "recurring_list" };
  }

  const threshold = parseAmountThreshold(q);
  if (threshold && /(expense|spend|spent|purchase|transaction)/.test(q)) {
    return { type: "amount_threshold", direction: threshold.direction, amount: threshold.amount, period: range, periodLabel: label };
  }

  if (/(most|top).*(frequent|common)|frequent.*expenses/.test(q)) {
    const numberMatch = q.match(/\b(\d+)\b/);
    const limit = numberMatch ? parseInt(numberMatch[1], 10) : 5;
    return { type: "most_frequent_items", period: range, periodLabel: label, limit: Number.isFinite(limit) && limit > 0 ? limit : 5 };
  }

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
  if (merchantName && /spend|spent|spending|cost|order|buy/.test(q)) {
    return { type: "merchant_spending", merchantName, period: range, periodLabel: label };
  }

  const categoryName = findKnownName(question, ctx.categoryNames);
  if (categoryName && /spend|spent|spending|cost|order|buy/.test(q)) {
    return { type: "category_spending", categoryName, period: range, periodLabel: label };
  }

  const itemName = findKnownName(question, ctx.frequentItemNames);
  if (itemName && /(average|approx|every month|per month|how much.*on)/.test(q)) {
    return { type: "item_average", itemName };
  }

  if (/how much.*(spend|spent|spending)/.test(q)) {
    return { type: "total_spending", period: range, periodLabel: label };
  }

  // Fallback to rich general financial analysis rather than throwing unknown!
  return { type: "general_financial", period: range, periodLabel: label };
}
