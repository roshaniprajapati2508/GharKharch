import { Store } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { dayGroupLabel } from "@/lib/date-utils";
import { EmptyState } from "@/components/shared/empty-state";
import type { Database } from "@/types/database";

type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];

/** Merchant analytics (spec section 25): total spend, visits, average, highest, last transaction. */
export function MerchantAnalyticsTab({ merchants }: { merchants: MerchantBreakdownRow[] }) {
  if (merchants.length === 0) {
    return <EmptyState title="No merchant spending yet" description="Expenses linked to a merchant in this period will show up here." variant="chart" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {merchants.map((m) => (
        <div key={m.merchant_id} className="rounded-xl border border-border bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Store className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{m.merchant_name}</p>
              <p className="text-xs text-muted-foreground">
                {m.txn_count} visit{m.txn_count === 1 ? "" : "s"} · last {dayGroupLabel(m.last_expense_date)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-foreground">{formatINR(m.total)}</p>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border pt-2.5 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground">Average</p>
              <p className="text-xs font-medium text-foreground">{formatINR(m.avg_transaction)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Highest</p>
              <p className="text-xs font-medium text-foreground">{formatINR(m.highest_transaction)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
