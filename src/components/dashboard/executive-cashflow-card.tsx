"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, PiggyBank, Briefcase, ChevronRight } from "lucide-react";
import { getExecutiveCashflow, type ExecutiveCashflow } from "@/lib/actions/insights";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getMonthRange } from "@/lib/date-utils";
import { formatINR, cn } from "@/lib/utils";

/**
 * Executive cashflow summary (spec: Module A) - Total Inflow, Total Outflow
 * (household vs. business), Net Savings + rate, and the Homemade Business's
 * own Net Profit + margin, for the current month. Deliberately a separate
 * card from CashflowWidget (Pillar 5, daily burn rate + budget health bars)
 * and MiniPnlCard (Feature 1, the business's own income/expense) - this one
 * is the household-wide "are we net positive this month" view that ties
 * both of those together.
 */
export function ExecutiveCashflowCard() {
  const [data, setData] = useState<ExecutiveCashflow | null | undefined>(undefined);

  async function load() {
    const range = getMonthRange();
    const result = await getExecutiveCashflow({ start: range.start, end: range.end });
    setData(result.error ? null : result.data);
  }

  useEffect(() => {
    load();
  }, []);

  useOnExpenseSaved(load);

  if (!data) return null;
  if (data.totalInflow === 0 && data.totalOutflow === 0) return null;

  const savingsPositive = data.netSavings >= 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <PiggyBank className="h-3.5 w-3.5" /> This Month&apos;s Cashflow
        </p>
        <Link href="/analytics" className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5">
          Analytics <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" /> Total Inflow
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatINR(data.totalInflow)}</p>
          {data.incomeByCategory.length > 0 && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {data.incomeByCategory.map((c) => `${c.categoryName}: ${formatINR(c.total)}`).join(" · ")}
            </p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-3 w-3" /> Total Outflow
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatINR(data.totalOutflow)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Household: {formatINR(data.outflowHousehold)} &middot; Business: {formatINR(data.outflowBusiness)}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-muted/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Net Savings</p>
          {data.savingsRatePct !== null && data.totalInflow > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                savingsPositive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {data.savingsRatePct.toFixed(0)}% savings rate
            </span>
          )}
        </div>
        <p className={cn("mt-1 text-xl font-bold tabular-nums", savingsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {savingsPositive ? "+" : ""}
          {formatINR(data.netSavings)}
        </p>
        {data.totalInflow === 0 && data.totalOutflow > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            No income logged yet this month
          </p>
        )}
      </div>

      {(data.businessIncome > 0 || data.businessExpense > 0) && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Briefcase className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-medium text-muted-foreground">Business Net Profit</p>
          </div>
          <div className="text-right">
            <p className={cn("text-sm font-bold tabular-nums", data.businessNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {data.businessNetProfit >= 0 ? "+" : ""}
              {formatINR(data.businessNetProfit)}
            </p>
            {data.businessMarginPct !== null && <p className="text-[10px] text-muted-foreground">Margin: {data.businessMarginPct.toFixed(0)}%</p>}
          </div>
        </div>
      )}
    </div>
  );
}
