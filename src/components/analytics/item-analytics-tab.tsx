"use client";

import { useMemo, useState } from "react";
import { cn, formatINR } from "@/lib/utils";
import { dayGroupLabel } from "@/lib/date-utils";
import { EmptyState } from "@/components/shared/empty-state";
import type { Database } from "@/types/database";

type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];

type FrequencyView = "frequent" | "expensive" | "consistent" | "growing";

const VIEWS: { key: FrequencyView; label: string }[] = [
  { key: "frequent", label: "Most frequent" },
  { key: "expensive", label: "Most expensive" },
  { key: "consistent", label: "Most consistent" },
  { key: "growing", label: "Fastest growing" },
];

interface GrowingItem {
  item_name: string;
  total: number;
  previousTotal: number;
  changePct: number;
}

/** Item + frequency analytics (spec section 26, 27): everyday consumption items, viewed four ways. */
export function ItemAnalyticsTab({
  items,
  previousItems,
}: {
  items: ItemAnalyticsRow[];
  previousItems: ItemAnalyticsRow[];
}) {
  const [view, setView] = useState<FrequencyView>("frequent");

  const growing = useMemo<GrowingItem[]>(() => {
    const prevByName = new Map(previousItems.map((i) => [i.item_name, parseFloat(i.total)]));
    return items
      .map((i) => {
        const previousTotal = prevByName.get(i.item_name) ?? 0;
        const total = parseFloat(i.total);
        const changePct = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : total > 0 ? 100 : 0;
        return { item_name: i.item_name, total, previousTotal, changePct };
      })
      .filter((i) => i.previousTotal > 0 && i.changePct > 0)
      .sort((a, b) => b.changePct - a.changePct);
  }, [items, previousItems]);

  const sorted = useMemo(() => {
    if (view === "expensive") return [...items].sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
    if (view === "consistent")
      return [...items].filter((i) => i.avg_gap_days !== null).sort((a, b) => parseFloat(a.avg_gap_days ?? "0") - parseFloat(b.avg_gap_days ?? "0"));
    return items; // already ordered by txn_count desc from SQL ("frequent")
  }, [items, view]);

  if (items.length === 0) {
    return <EmptyState title="No item data yet" description="Once you log a few expenses, everyday items like Milk or Petrol will show up here." variant="search" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              view === v.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "growing" ? (
        growing.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing is trending up yet — check back after a couple of months.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {growing.slice(0, 15).map((item) => (
              <div key={item.item_name} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                <p className="truncate text-sm font-medium capitalize text-foreground">{item.item_name}</p>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">{formatINR(item.total)}</p>
                  <p className="text-[11px] font-medium text-brand-orange">+{item.changePct.toFixed(0)}% vs last period</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.slice(0, 20).map((item) => (
            <div key={item.item_name} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium capitalize text-foreground">{item.item_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.txn_count}× · avg {formatINR(item.avg_amount)}
                  {item.avg_gap_days ? ` · every ~${item.avg_gap_days}d` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{formatINR(item.total)}</p>
                <p className="text-[11px] text-muted-foreground">last {dayGroupLabel(item.last_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
