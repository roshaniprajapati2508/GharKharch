"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { cn, formatINR, percentChange } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Sparkline } from "@/components/analytics/merchant-analytics-tab";
import { getCategoryMonthlyTrend } from "@/lib/actions/analytics";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];

/** Category analytics (spec section 24): total, %, count, avg, highest/lowest, trend vs the previous period, and a trailing monthly trend sparkline. */
export function CategoryAnalyticsTab({
  categories,
  previousCategories,
  grandTotal,
}: {
  categories: CategoryBreakdownRow[];
  previousCategories: CategoryBreakdownRow[];
  grandTotal: number;
}) {
  const [trends, setTrends] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function loadTrends() {
      const entries = await Promise.all(
        categories.map(async (c) => {
          const result = await getCategoryMonthlyTrend(c.category_id, 6);
          const values = result.data ? result.data.map((row) => parseFloat(row.total)) : [];
          return [c.category_id, values] as const;
        })
      );
      if (!cancelled) setTrends(new Map(entries));
    }
    if (categories.length > 0) loadTrends();
    return () => {
      cancelled = true;
    };
  }, [categories]);

  if (categories.length === 0) {
    return <EmptyState title="No category spending yet" description="Categorized expenses in this period will show up here." variant="chart" />;
  }

  const prevByCategory = new Map(previousCategories.map((c) => [c.category_id, c]));

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => {
        const total = parseFloat(cat.total);
        const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
        const prev = prevByCategory.get(cat.category_id);
        const change = prev ? percentChange(total, parseFloat(prev.total)) : null;

        return (
          <div key={cat.category_id} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{cat.category_name}</p>
                <p className="text-xs text-muted-foreground">
                  {cat.txn_count} transaction{cat.txn_count === 1 ? "" : "s"} · {pct.toFixed(0)}%
                </p>
              </div>
              <Sparkline values={trends.get(cat.category_id) ?? []} />
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-foreground">{formatINR(total)}</p>
                {change !== null && (
                  <p className={cn("flex items-center justify-end gap-0.5 text-[11px] font-medium", change <= 0 ? "text-brand-green" : "text-brand-orange")}>
                    {change <= 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                    {Math.abs(change).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Average</p>
                <p className="text-xs font-medium text-foreground">{formatINR(cat.avg_transaction)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Highest</p>
                <p className="text-xs font-medium text-foreground">{formatINR(cat.highest_transaction)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Lowest</p>
                <p className="text-xs font-medium text-foreground">{formatINR(cat.lowest_transaction)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
