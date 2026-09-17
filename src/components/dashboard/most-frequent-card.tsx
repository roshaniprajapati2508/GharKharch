import { Repeat } from "lucide-react";
import type { Database } from "@/types/database";

type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];

/** "Most frequent" (spec item 28): the household's most-repeated purchases this period, ranked by transaction count. */
export function MostFrequentCard({ items, limit = 5 }: { items: ItemAnalyticsRow[]; limit?: number }) {
  const shown = [...items].sort((a, b) => b.txn_count - a.txn_count).slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Most frequent</h3>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {shown.map((item) => (
          <div key={item.item_name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
              <Repeat className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-foreground">{item.item_name}</p>
            <p className="shrink-0 text-xs text-muted-foreground">
              {item.txn_count} purchase{item.txn_count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
