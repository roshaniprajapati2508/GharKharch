"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { getBusinessPnl, type BusinessPnl } from "@/lib/actions/analytics";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getMonthRange } from "@/lib/date-utils";
import { formatINR, cn } from "@/lib/utils";
import type { DateRange } from "@/lib/date-utils";

/**
 * Mini P&L for the Homemade Business (spec: Feature 1) - income vs. expense
 * and a net profit figure for a date range. Defaults to the current month
 * when no range is passed (the Dashboard's use case); the Analytics screen
 * passes its own selected range so this always matches whatever period the
 * rest of that page is showing.
 *
 * Renders nothing once loaded if there's no business activity in range (no
 * income and no business expense) - a household that doesn't run a home
 * business, or hasn't logged anything from it this period, shouldn't see an
 * empty P&L card. Also renders nothing (silently) if the underlying
 * get_business_pnl() function doesn't exist yet - migration 022 not run -
 * rather than surfacing a raw Postgres error on every Analytics/Dashboard
 * load for a feature the household hasn't turned on yet.
 */
export function MiniPnlCard({ range }: { range?: DateRange }) {
  const effectiveRange = range ?? getMonthRange();
  const [pnl, setPnl] = useState<BusinessPnl | null | undefined>(undefined); // undefined = loading

  async function load() {
    const result = await getBusinessPnl(effectiveRange);
    setPnl(result.error ? null : result.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRange.start, effectiveRange.end]);

  useOnExpenseSaved(load);

  if (pnl === undefined) return null; // avoid a flash of an empty-state card while loading
  if (pnl === null) return null; // RPC missing or errored - migration not run yet
  if (pnl.incomeCount === 0 && pnl.expenseCount === 0) return null;

  const profitable = pnl.netProfit >= 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" /> Business Mini P&amp;L
        </p>
        <div className="flex items-center gap-2">
          {pnl.incomeTotal > 0 && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {((pnl.netProfit / pnl.incomeTotal) * 100).toFixed(1)}% Margin
            </span>
          )}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              profitable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {profitable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {profitable ? "Net Profit" : "Net Loss"}
          </span>
        </div>
      </div>

      <p className={cn("text-2xl font-bold tabular-nums", profitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {profitable ? "+" : "-"}
        {formatINR(Math.abs(pnl.netProfit))}
      </p>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Total Inflow / Sales ({pnl.incomeCount})
          </p>
          <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatINR(pnl.incomeTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Total Outflow / Cost ({pnl.expenseCount})
          </p>
          <p className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
            -{formatINR(pnl.expenseTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
