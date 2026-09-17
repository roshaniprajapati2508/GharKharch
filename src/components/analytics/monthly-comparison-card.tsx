import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatINR, percentChange } from "@/lib/utils";
import type { Database } from "@/types/database";
import type { DateRange } from "@/lib/date-utils";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return null;
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-semibold", change <= 0 ? "text-brand-green" : "text-brand-orange")}>
      {change <= 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

/** Period-over-period comparison (spec section 29): totals, then the categories and merchants that moved the most. */
export function MonthlyComparisonCard({
  range,
  previousRange,
  summary,
  previousSummary,
  categories,
  previousCategories,
  merchants,
  previousMerchants,
}: {
  range: DateRange;
  previousRange: DateRange;
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categories: CategoryBreakdownRow[];
  previousCategories: CategoryBreakdownRow[];
  merchants: MerchantBreakdownRow[];
  previousMerchants: MerchantBreakdownRow[];
}) {
  const total = parseFloat(summary.total);
  const prevTotal = parseFloat(previousSummary.total);
  const dailyAvg = total / Math.max(summary.days, 1);
  const prevDailyAvg = prevTotal / Math.max(previousSummary.days, 1);

  const prevCatMap = new Map(previousCategories.map((c) => [c.category_id, parseFloat(c.total)]));
  const categoryChanges = categories
    .map((c) => ({ name: c.category_name, current: parseFloat(c.total), previous: prevCatMap.get(c.category_id) ?? 0 }))
    .filter((c) => c.previous > 0)
    .map((c) => ({ ...c, change: c.current - c.previous, pct: percentChange(c.current, c.previous) }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  const prevMerchantMap = new Map(previousMerchants.map((m) => [m.merchant_id, parseFloat(m.total)]));
  const merchantChanges = merchants
    .map((m) => ({ name: m.merchant_name, current: parseFloat(m.total), previous: prevMerchantMap.get(m.merchant_id) ?? 0 }))
    .filter((m) => m.previous > 0)
    .map((m) => ({ ...m, change: m.current - m.previous, pct: percentChange(m.current, m.previous) }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  if (prevTotal === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">Monthly comparison</h3>
        <p className="mt-2 text-sm text-muted-foreground">Not enough history in {previousRange.label.toLowerCase()} yet to compare.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {range.label} vs {previousRange.label}
      </h3>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Total", current: total, previous: prevTotal, format: formatINR },
          { label: "Transactions", current: summary.txn_count, previous: previousSummary.txn_count, format: (n: number) => String(n) },
          { label: "Avg / day", current: dailyAvg, previous: prevDailyAvg, format: formatINR },
        ].map((row) => (
          <div key={row.label} className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[11px] text-muted-foreground">{row.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{row.format(row.current)}</p>
            <div className="mt-0.5 flex justify-center">
              <ChangeBadge change={percentChange(row.current, row.previous)} />
            </div>
          </div>
        ))}
      </div>

      {categoryChanges.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Category changes</p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {categoryChanges.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <p className="truncate text-foreground">{c.name}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatINR(c.previous)} → {formatINR(c.current)}
                  </p>
                  <ChangeBadge change={c.pct} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {merchantChanges.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Merchant changes</p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {merchantChanges.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <p className="truncate text-foreground">{m.name}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatINR(m.previous)} → {formatINR(m.current)}
                  </p>
                  <ChangeBadge change={m.pct} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
