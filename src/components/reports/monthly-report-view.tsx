import { ArrowDown, ArrowUp, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
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
  const incomeTotal = data.incomeTotal ?? 0;
  const netSavings = data.netSavings ?? (incomeTotal - total);
  const isPositiveNet = netSavings >= 0;

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

  const memberNameMap = new Map<string, string>();
  memberNameMap.set(userId, "You");
  if (partner) {
    memberNameMap.set(partner.id, partner.displayName.split(" ")[0]);
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-gradient-to-b from-brand-mint/40 via-surface to-surface p-6 print:border-none print:bg-white print:p-0 sm:p-8 space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">GharKharch Financial Report</p>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {data.range.label}
          </span>
        </div>

        {/* Hero Cashflow Box */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Net Period Cashflow</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className={cn("text-4xl font-black tabular-nums tracking-tight", isPositiveNet ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {isPositiveNet ? "+" : "-"}{formatINR(Math.abs(netSavings))}
            </p>
            <span className={cn("flex items-center gap-0.5 text-xs font-bold rounded-md px-1.5 py-0.5", isPositiveNet ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
              {isPositiveNet ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isPositiveNet ? "Net Surplus / Profit" : "Net Outflow"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Inflows / Credits ({data.incomeCount ?? 0})
              </p>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{formatINR(incomeTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Total Debits / Expenses ({data.summary.txn_count})
              </p>
              <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                -{formatINR(total)}
              </p>
            </div>
          </div>
        </div>

        {change !== null && prevTotal > 0 && (
          <p className={cn("mt-3 flex items-center gap-1 text-xs font-semibold", change <= 0 ? "text-brand-green" : "text-brand-orange")}>
            {change <= 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            Spend changed by {Math.abs(change).toFixed(1)}% vs previous period ({formatINR(prevTotal)})
          </p>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-card border border-border/60 p-3.5 print:bg-transparent">
        <div className="text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Transactions</p>
          <p className="mt-0.5 text-base font-bold text-foreground">{data.summary.txn_count + (data.incomeCount ?? 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Daily Spend Avg</p>
          <p className="mt-0.5 text-base font-bold text-foreground">{formatINR(total / Math.max(data.summary.days, 1))}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Top Category</p>
          <p className="mt-0.5 truncate text-base font-bold text-foreground">{data.categoryBreakdown[0]?.category_name ?? "-"}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spending Breakdown by Category</h2>
          <div className="mt-3 flex flex-col gap-3">
            {data.categoryBreakdown.slice(0, 6).map((cat) => {
              const pct = total > 0 ? (parseFloat(cat.total) / total) * 100 : 0;
              return (
                <div key={cat.category_id} className="flex items-center gap-3">
                  <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-foreground">{cat.category_name}</p>
                      <p className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        {pct.toFixed(0)}% · -{formatINR(cat.total)}
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

      {/* Top Outflows / Expenses */}
      {data.topExpenses.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="h-3.5 w-3.5" /> Top Debits &amp; Expenses
            </h2>
            <span className="text-[10px] font-semibold text-muted-foreground">By Amount</span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {data.topExpenses.slice(0, 5).map((e, i) => {
              const timeLabel = formatExpenseTime(e.expense_time, e.created_at);
              const payer = memberNameMap.get(e.paid_by) ?? "Member";
              return (
                <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-foreground font-medium">
                      <span className="text-muted-foreground font-bold mr-1">{i + 1}.</span>
                      <span className="capitalize">{e.item_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayGroupLabel(e.expense_date)}
                      {timeLabel ? ` · ${timeLabel}` : ""}
                      {e.category_name ? ` · ${e.category_name}` : ""}
                      {` · By ${payer}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    -{formatINR(e.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top Inflows / Credits */}
      {data.topInflows && data.topInflows.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-3.5 w-3.5" /> Top Inflows &amp; Credits
            </h2>
            <span className="text-[10px] font-semibold text-muted-foreground">By Amount</span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {data.topInflows.slice(0, 5).map((e, i) => {
              const timeLabel = formatExpenseTime(e.expense_time, e.created_at);
              const receiver = memberNameMap.get(e.paid_by) ?? "Member";
              return (
                <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-foreground font-medium">
                      <span className="text-muted-foreground font-bold mr-1">{i + 1}.</span>
                      <span className="capitalize">{e.item_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayGroupLabel(e.expense_date)}
                      {timeLabel ? ` · ${timeLabel}` : ""}
                      {e.category_name ? ` · ${e.category_name}` : ""}
                      {` · For ${receiver}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatINR(e.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Household Member Comparison */}
      {personRows.length > 0 && total > 0 && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Member Spend Contribution</h2>
          <div className="mt-3 flex flex-col gap-2">
            {personRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <p className="font-medium text-foreground">{p.label}</p>
                <p className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  -{formatINR(p.total)} <span className="font-normal text-muted-foreground text-xs">({p.txnCount} txns)</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Financial Insights</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {insights.slice(0, 5).map((insight) => (
              <li key={insight.id} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[11px] text-muted-foreground pt-2">
        Generated by GharKharch · {displayName}&apos;s household · Confidential
      </p>
    </div>
  );
}
