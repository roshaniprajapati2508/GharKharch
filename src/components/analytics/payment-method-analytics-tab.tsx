import { Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import type { Database } from "@/types/database";

type PaymentMethodBreakdownRow = Database["public"]["Functions"]["get_payment_method_breakdown"]["Returns"][number];

/** Payment method breakdown (spec section 8, wishlist gap): total, count, and share by the free-text `expenses.payment_method` column. */
export function PaymentMethodAnalyticsTab({ methods }: { methods: PaymentMethodBreakdownRow[] }) {
  if (methods.length === 0) {
    return <EmptyState title="No payment method data yet" description="Expenses with a payment method logged in this period will show up here." variant="chart" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {methods.map((m) => {
        const pct = parseFloat(m.share_pct);
        return (
          <div key={m.payment_method} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{m.payment_method}</p>
                <p className="text-xs text-muted-foreground">
                  {m.txn_count} transaction{m.txn_count === 1 ? "" : "s"} · {pct.toFixed(0)}% of total
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-foreground">{formatINR(m.total)}</p>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
