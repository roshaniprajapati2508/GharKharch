import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { formatINR, percentChange, cn } from "@/lib/utils";
import { getIcon } from "@/lib/icon-map";
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

/** Top-of-dashboard summary (spec section 7): headline total + comparison, then a stat grid. */
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
  const weeklyAvg = dailyAvg * 7;

  const topCategory = categoryBreakdown[0] ?? null;
  const TopCategoryIcon = topCategory ? getIcon(topCategory.icon) : null;
  const frequentMerchant = mostFrequentMerchant(topMerchants);
  const highestDay = highestSpendingDayLabel(dailySpending);

  const stats: { label: string; value: string }[] = [
    { label: "Daily average", value: formatINR(dailyAvg) },
    { label: "Weekly average", value: formatINR(weeklyAvg) },
    { label: "Transactions", value: String(summary.txn_count) },
    { label: "Largest expense", value: summary.largest_amount ? formatINR(summary.largest_amount) : "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
        <p className="mt-1 text-[2.75rem] font-bold leading-none tracking-tight text-foreground">{formatINR(total)}</p>
        {change !== null && prevTotal > 0 && (
          <p className={cn("mt-1.5 flex items-center gap-1 text-sm font-medium", change <= 0 ? "text-brand-green" : "text-brand-orange")}>
            {change <= 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            {Math.abs(change).toFixed(1)}% vs previous period
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {(topCategory || frequentMerchant || highestDay) && (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {topCategory && TopCategoryIcon && (
            <div className="flex items-center gap-3 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
                {/* eslint-disable-next-line react-hooks/static-components -- TopCategoryIcon is a stable reference picked from ICON_MAP, not created here */}
                <TopCategoryIcon className="h-4 w-4" />
              </span>
              <p className="text-sm text-foreground">
                <span className="font-medium">{topCategory.category_name}</span> is your most-used category
              </p>
            </div>
          )}
          {frequentMerchant && (
            <div className="flex items-center gap-3 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary text-xs font-semibold">
                {frequentMerchant.txn_count}×
              </span>
              <p className="text-sm text-foreground">
                <span className="font-medium">{frequentMerchant.merchant_name}</span> is your most frequent merchant
              </p>
            </div>
          )}
          {highestDay && (
            <div className="flex items-center gap-3 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
                <TrendingUp className="h-4 w-4" />
              </span>
              <p className="text-sm text-foreground">
                <span className="font-medium">{highestDay}</span> is your highest-spending day
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
