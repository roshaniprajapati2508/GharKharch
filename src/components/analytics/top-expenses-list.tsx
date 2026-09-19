import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import { dayGroupLabel, formatExpenseTime } from "@/lib/date-utils";
import { TrendingDown, ArrowUpRight } from "lucide-react";
import type { TopExpenseRow } from "@/lib/actions/analytics";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];

/** Biggest individual transactions in the period (spec section 31 "Top purchases"). */
export function TopExpensesList({ expenses, categories }: { expenses: TopExpenseRow[]; categories: CategoryBreakdownRow[] }) {
  if (expenses.length === 0) return null;
  const categoryMap = new Map(categories.map((c) => [c.category_id, c]));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">Top Expenses &amp; Debits</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
          <ArrowUpRight className="h-3 w-3" /> Outflow / Debit
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {expenses.map((e, i) => {
          const cat = categoryMap.get(e.category_id);
          const icon = e.category_icon ?? cat?.icon;
          const color = e.category_color ?? cat?.color;
          const catName = e.category_name ?? cat?.category_name;
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
                  {catName ? ` · ${catName}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                -{formatINR(e.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
