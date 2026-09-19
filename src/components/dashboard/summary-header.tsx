import { ArrowDown, ArrowUp, Calendar, CreditCard, Receipt, Tag, TrendingUp, Sparkles } from "lucide-react";
import { formatINR, percentChange, cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];

function highestSpendingDayLabel(daily: DailySpendingRow[]): string | null {
  if (daily.length === 0) return null;
  const top = daily.reduce((max, d) => (parseFloat(d.total) > parseFloat(max.total) ? d : max), daily[0]);
  if (parseFloat(top.total) === 0) return null;
  const date = new Date(`${top.expense_date}T00:00:00Z`);
  return date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

function mostFrequentMerchant(merchants: MerchantBreakdownRow[]): MerchantBreakdownRow | null {
  if (merchants.length === 0) return null;
  return merchants.reduce((max, m) => (m.txn_count > max.txn_count ? m : max), merchants[0]);
}

/** Enterprise Bento KPI Header: headline total with delta pill, 4 modern metric cards, and smart key takeaways. */
export function SummaryHeader({
  periodLabel,
  summary,
  previousSummary,
  categoryBreakdown,
  topMerchants,
  dailySpending,
}: {
  periodLabel: string;
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categoryBreakdown: CategoryBreakdownRow[];
  topMerchants: MerchantBreakdownRow[];
  dailySpending: DailySpendingRow[];
}) {
  const total = parseFloat(summary.total);
  const prevTotal = parseFloat(previousSummary.total);
  const change = percentChange(total, prevTotal);
  const days = Math.max(summary.days, 1);
  const dailyAvg = total / days;
  const avgPerTxn = summary.txn_count > 0 ? total / summary.txn_count : 0;

  const topCategory = categoryBreakdown[0] ?? null;
  const topCatTotal = topCategory ? parseFloat(topCategory.total) : 0;
  const topCatShare = total > 0 && topCatTotal > 0 ? Math.round((topCatTotal / total) * 100) : 0;

  const frequentMerchant = mostFrequentMerchant(topMerchants);
  const highestDay = highestSpendingDayLabel(dailySpending);

  return (
    <div className="flex flex-col gap-4">
      {/* Hero Spend Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-5 shadow-xs backdrop-blur-md">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 text-brand-primary" /> Total Outflow &middot; {periodLabel}
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl tabular-nums">
                {formatINR(total)}
              </span>
              {change !== null && prevTotal > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs",
                    change <= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  )}
                >
                  {change <= 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  {Math.abs(change).toFixed(1)}% vs prev period
                </span>
              )}
            </div>
          </div>
          {prevTotal > 0 && (
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Previous Period</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(prevTotal)}</p>
            </div>
          )}
        </div>
      </div>

      {/* 4 Bento Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Card 1: Daily Average */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xs backdrop-blur-md transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Daily Run Rate</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
              <Calendar className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{formatINR(dailyAvg)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{days} active days in period</p>
        </div>

        {/* Card 2: Avg Transaction */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xs backdrop-blur-md transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Avg / Ticket</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
            {summary.txn_count > 0 ? formatINR(avgPerTxn) : "₹0"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{summary.txn_count} transaction{summary.txn_count === 1 ? "" : "s"} logged</p>
        </div>

        {/* Card 3: Largest Expense */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xs backdrop-blur-md transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Largest Expense</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
            {summary.largest_amount ? formatINR(summary.largest_amount) : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Single peak transaction</p>
        </div>

        {/* Card 4: Top Category */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xs backdrop-blur-md transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Top Category</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Tag className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 truncate text-lg font-bold text-foreground">
            {topCategory?.category_name ?? "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {topCatTotal > 0 ? `${formatINR(topCatTotal)} (${topCatShare}% of total)` : "No categories yet"}
          </p>
        </div>
      </div>

      {/* Highlights / Intelligence Ribbon */}
      {(frequentMerchant || highestDay) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3.5 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-primary" /> Key highlights:
          </span>
          {frequentMerchant && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
              Most frequent merchant: <strong className="text-brand-primary">{frequentMerchant.merchant_name}</strong> ({frequentMerchant.txn_count}×)
            </span>
          )}
          {highestDay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
              Peak day: <strong className="text-brand-primary">{highestDay}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
