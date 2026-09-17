import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import { dayGroupLabel } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type TopExpenseRow = Database["public"]["Functions"]["get_top_expenses"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];

/** Biggest individual transactions in the period (spec section 31 "Top purchases"). */
export function TopExpensesList({ expenses, categories }: { expenses: TopExpenseRow[]; categories: CategoryBreakdownRow[] }) {
  if (expenses.length === 0) return null;
  const categoryMap = new Map(categories.map((c) => [c.category_id, c]));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Top expenses</h3>
      <div className="mt-3 flex flex-col gap-2.5">
        {expenses.map((e, i) => {
          const cat = categoryMap.get(e.category_id);
          return (
            <div key={e.id} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <CategoryIcon icon={cat?.icon} color={cat?.color} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{e.item_name}</p>
                <p className="text-xs text-muted-foreground">{dayGroupLabel(e.expense_date)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground">{formatINR(e.amount)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
