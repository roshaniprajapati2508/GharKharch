"use client";

import { formatINR } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import type { Database } from "@/types/database";

type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];

/** "You vs Wife" comparison (spec section 8C, 36). */
export function PersonComparisonCard({ personBreakdown }: { personBreakdown: PersonBreakdownRow[] }) {
  const { userId, partner } = useHousehold();

  if (!partner || personBreakdown.length === 0) return null;

  const grandTotal = personBreakdown.reduce((sum, p) => sum + parseFloat(p.total), 0);
  if (grandTotal === 0) return null;

  const rows = [
    { id: userId, label: "You" },
    { id: partner.id, label: partner.displayName.split(" ")[0] },
  ].map((person) => {
    const row = personBreakdown.find((p) => p.paid_by === person.id);
    const total = row ? parseFloat(row.total) : 0;
    return {
      ...person,
      total,
      txnCount: row?.txn_count ?? 0,
      avg: row ? parseFloat(row.avg_transaction) : 0,
      pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Spending by person</h3>
      <div className="mt-3 flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-sm font-semibold text-foreground">{formatINR(row.total)}</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, row.pct)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {row.pct.toFixed(0)}% · {row.txnCount} expense{row.txnCount === 1 ? "" : "s"} · avg {formatINR(row.avg)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
