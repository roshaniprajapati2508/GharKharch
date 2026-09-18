import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { formatINR } from "@/lib/utils";
import type { Database } from "@/types/database";

type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];

/** "Where we shop" (spec section 26) - compact dashboard version of the merchant breakdown; the full list lives in Analytics. */
export function TopMerchantsCard({ merchants, limit = 5 }: { merchants: MerchantBreakdownRow[]; limit?: number }) {
  const shown = merchants.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Where we shop</h3>
        <Link href="/analytics" className="flex items-center text-xs font-medium text-primary">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {shown.map((m) => (
          <Link
            key={m.merchant_id}
            href={`/more/merchants/${m.merchant_id}`}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
              <Store className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{m.merchant_name}</p>
              <p className="text-xs text-muted-foreground">{m.txn_count} purchase{m.txn_count === 1 ? "" : "s"}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-foreground">{formatINR(m.total)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
