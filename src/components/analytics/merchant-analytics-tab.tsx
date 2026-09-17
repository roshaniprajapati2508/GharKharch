"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { dayGroupLabel } from "@/lib/date-utils";
import { EmptyState } from "@/components/shared/empty-state";
import { getMerchantMonthlyTrend } from "@/lib/actions/analytics";
import type { Database } from "@/types/database";

type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];

/** Tiny inline sparkline for a merchant's trailing monthly spend — no charting library needed for something this small. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const width = 64;
  const height = 20;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" role="img" aria-label="Monthly spend trend">
      <polyline points={points} fill="none" stroke="var(--brand-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Merchant analytics (spec section 25): total spend, visits, average, highest/lowest, share of total, last transaction, and a monthly trend sparkline. */
export function MerchantAnalyticsTab({ merchants }: { merchants: MerchantBreakdownRow[] }) {
  const [trends, setTrends] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function loadTrends() {
      const entries = await Promise.all(
        merchants.map(async (m) => {
          const result = await getMerchantMonthlyTrend(m.merchant_id, 6);
          const values = result.data ? result.data.map((row) => parseFloat(row.total)) : [];
          return [m.merchant_id, values] as const;
        })
      );
      if (!cancelled) setTrends(new Map(entries));
    }
    if (merchants.length > 0) loadTrends();
    return () => {
      cancelled = true;
    };
  }, [merchants]);

  if (merchants.length === 0) {
    return <EmptyState title="No merchant spending yet" description="Expenses linked to a merchant in this period will show up here." variant="chart" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {merchants.map((m) => {
        const sharePct = parseFloat(m.share_pct);
        return (
          <div key={m.merchant_id} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Store className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{m.merchant_name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.txn_count} visit{m.txn_count === 1 ? "" : "s"} · {sharePct.toFixed(0)}% of total · last {dayGroupLabel(m.last_expense_date)}
                </p>
              </div>
              <Sparkline values={trends.get(m.merchant_id) ?? []} />
              <p className="shrink-0 text-sm font-bold text-foreground">{formatINR(m.total)}</p>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Average</p>
                <p className="text-xs font-medium text-foreground">{formatINR(m.avg_transaction)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Highest</p>
                <p className="text-xs font-medium text-foreground">{formatINR(m.highest_transaction)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Lowest</p>
                <p className="text-xs font-medium text-foreground">{formatINR(m.lowest_transaction)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
