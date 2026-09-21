"use client";

import { useEffect, useState } from "react";
import { Gauge, Flame, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getCashflowSnapshot, type CashflowSnapshot } from "@/lib/actions/insights";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { formatINR, cn } from "@/lib/utils";
import { CategoryIcon } from "@/lib/icon-map";

/** emerald under 70% of budget, amber 70-100%, rose over budget - same three-tier convention as the rest of this app's health indicators. */
function healthColor(pct: number): string {
  if (pct >= 100) return "bg-rose-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

/**
 * Cashflow Velocity / Financial Runway widget (spec: Pillar 5) - daily burn
 * rate, an inflow-vs-outflow gauge (business income vs. total spend, so it
 * only shows meaningful "inflow" once Mini P&L / Feature 1 has income
 * logged), and budget health bars reusing the existing Budgets feature.
 */
export function CashflowWidget({ initialData }: { initialData?: CashflowSnapshot | null }) {
  const [snapshot, setSnapshot] = useState<CashflowSnapshot | null | undefined>(
    initialData !== undefined ? initialData : undefined
  );

  async function load() {
    const result = await getCashflowSnapshot();
    setSnapshot(result.error ? null : result.data);
  }

  useEffect(() => {
    if (initialData === undefined) {
      load();
    }
  }, [initialData]);

  useOnExpenseSaved(load);

  if (!snapshot) return null;

  const total = snapshot.inflow + snapshot.outflow;
  const inflowPct = total > 0 ? (snapshot.inflow / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4 space-y-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Gauge className="h-3.5 w-3.5" /> Cashflow Velocity
      </p>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Flame className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatINR(snapshot.dailyBurnRate)}<span className="text-xs font-medium text-muted-foreground">/day</span></p>
          <p className="text-[10px] text-muted-foreground">Daily burn rate this month</p>
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${inflowPct}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${100 - inflowPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3 w-3" /> In: {formatINR(snapshot.inflow)}
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              Out: {formatINR(snapshot.outflow)} <ArrowDownRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}

      {snapshot.categoryHealth.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold text-muted-foreground">Budget health</p>
          {snapshot.categoryHealth.map((b) => {
            const budgetAmount = Number(b.amount) || 1;
            const pct = Math.min(150, (b.spent / budgetAmount) * 100);
            return (
              <div key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-foreground">
                    <CategoryIcon icon={b.category_icon} color={b.category_color} className="flex h-3.5 w-3.5 items-center justify-center rounded" />
                    {b.category_name ?? "Uncategorized"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatINR(b.spent)} / {formatINR(budgetAmount)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", healthColor(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
