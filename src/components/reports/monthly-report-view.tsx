import { ArrowDown, ArrowUp } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { cn, formatINR, percentChange } from "@/lib/utils";
import { dayGroupLabel, formatExpenseTime } from "@/lib/date-utils";
import { generateInsights } from "@/lib/expense-intelligence/spending-analyzer";
import { useHousehold } from "@/lib/context/household-context";
import type { ReportData } from "@/lib/actions/reports";

/** The premium monthly-report layout (spec section 32) - also what prints to PDF via the browser's print dialog. */
export function MonthlyReportView({ data }: { data: ReportData }) {
  const { userId, displayName, partner } = useHousehold();
  const total = parseFloat(data.summary.total);
  const prevTotal = parseFloat(data.previousSummary.total);
  const change = percentChange(total, prevTotal);
  const insights = generateInsights({
    range: data.range,
    previousRange: data.previousRange,
    summary: data.summary,
    previousSummary: data.previousSummary,
    categoryBreakdown: data.categoryBreakdown,
    previousCategoryBreakdown: data.previousCategoryBreakdown,
    merchantBreakdown: data.merchantBreakdown,
    itemAnalytics: data.itemAnalytics,
    dailySpending: data.dailySpending,
    topExpenses: data.topExpenses,
  });

  const personRows = [
    { id: userId, label: "You" },
    ...(partner ? [{ id: partner.id, label: partner.displayName.split(" ")[0] }] : []),
  ].map((p) => {
    const row = data.personBreakdown.find((r) => r.paid_by === p.id);
    return { ...p, total: row ? parseFloat(row.total) : 0, txnCount: row?.txn_count ?? 0 };
  });

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-gradient-to-b from-brand-mint/50 to-white p-6 print:border-none print:bg-white print:p-0 sm:p-8">
      <p className="text-sm font-medium text-brand-primary">GharKharch</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{data.range.label}</h1>
      <p className="mt-3 text-5xl font-bold tracking-tight text-foreground">{formatINR(total)}</p>
      <p className="text-sm text-muted-foreground">spent as a household</p>

      {change !== null && prevTotal > 0 && (
        <p className={cn("mt-2 flex items-center gap-1 text-sm font-semibold", change <= 0 ? "text-brand-green" : "text-brand-orange")}>
          {change <= 0 ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          {Math.abs(change).toFixed(1)}% vs {data.previousRange.label.toLowerCase()}
        </p>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-white/70 p-4 print:bg-transparent">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="mt-0.5 text-lg font-semibold text-foreground">{data.summary.txn_count}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Daily average</p>
          <p className="mt-0.5 text-lg font-semibold text-foreground">{formatINR(total / Math.max(data.summary.days, 1))}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Top category</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{data.categoryBreakdown[0]?.category_name ?? "-"}</p>
        </div>
      </div>

      {data.categoryBreakdown.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Where it went</h2>
          <div className="mt-3 flex flex-col gap-3">
            {data.categoryBreakdown.slice(0, 6).map((cat) => {
              const pct = total > 0 ? (parseFloat(cat.total) / total) * 100 : 0;
              return (
                <div key={cat.category_id} className="flex items-center gap-3">
                  <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-medium text-foreground">{cat.category_name}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {pct.toFixed(0)}% · {formatINR(cat.total)}
                      </p>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.topExpenses.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top purchases</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.topExpenses.slice(0, 5).map((e, i) => {
              const timeLabel = formatExpenseTime(e.expense_time, e.created_at);
              return (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <p className="truncate text-foreground">
                    {i + 1}. <span className="capitalize font-medium">{e.item_name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {dayGroupLabel(e.expense_date)}
                      {timeLabel ? ` · ${timeLabel}` : ""}
                    </span>
                  </p>
                  <p className="shrink-0 font-semibold text-foreground">{formatINR(e.amount)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {personRows.length === 2 && total > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Household comparison</h2>
          <div className="mt-3 flex flex-col gap-2">
            {personRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <p className="text-foreground">{p.label}</p>
                <p className="font-semibold text-foreground">
                  {formatINR(p.total)} <span className="font-normal text-muted-foreground">({p.txnCount})</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {insights.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key insights</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {insights.slice(0, 5).map((insight) => (
              <li key={insight.id} className="text-sm text-foreground">
                • {insight.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-[11px] text-muted-foreground">Generated by GharKharch · {displayName}&apos;s household</p>
    </div>
  );
}
