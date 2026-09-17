import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];

/** Category breakdown (spec section 8B): amount, percentage, transaction count, capped to the top few on the dashboard. */
export function CategoryBreakdownList({ categories, grandTotal, limit = 5 }: { categories: CategoryBreakdownRow[]; grandTotal: number; limit?: number }) {
  const shown = categories.slice(0, limit);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Where it went</h3>
        <Link href="/analytics" className="flex items-center text-xs font-medium text-primary">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {shown.map((cat) => {
          const total = parseFloat(cat.total);
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          return (
            <div key={cat.category_id} className="flex items-center gap-3">
              <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{cat.category_name}</p>
                  <p className="shrink-0 text-sm font-semibold text-foreground">{formatINR(total)}</p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {pct.toFixed(0)}% · {cat.txn_count}×
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
