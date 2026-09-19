import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import { dayGroupLabel, formatExpenseTime } from "@/lib/date-utils";
import { TrendingUp, ArrowDownLeft } from "lucide-react";
import type { TopExpenseRow } from "@/lib/actions/analytics";

/** Top credit / income transactions in the period (e.g. Marketplace payouts, business sales, salary, client fees). */
export function TopInflowsList({ inflows }: { inflows: TopExpenseRow[] }) {
  if (!inflows || inflows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">Top Inflows &amp; Credits</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <ArrowDownLeft className="h-3 w-3" /> Inflow
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {inflows.map((e, i) => {
          const icon = e.category_icon ?? "shopping-bag";
          const color = e.category_color ?? "emerald";
          const timeLabel = formatExpenseTime(e.expense_time, e.created_at);
          return (
            <div key={e.id} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <CategoryIcon icon={icon} color={color} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground capitalize">{e.item_name}</p>
                <p className="text-xs text-muted-foreground">
                  {dayGroupLabel(e.expense_date)}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                  {e.category_name ? ` · ${e.category_name}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                +{formatINR(e.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
