"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, CreditCard, Smartphone, Banknote } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { getPaymentDepthData, getCashComparison, type PaymentDepthData, type CashComparison } from "@/lib/actions/analytics";
import type { DateRange } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type PaymentMethodBreakdownRow = Database["public"]["Functions"]["get_payment_method_breakdown"]["Returns"][number];

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** Payment analytics depth (spec section 8, batch phase): the free-text payment-method breakdown, plus by-card, by-UPI-app depth, and a cash this-month-vs-last-month comparison — each in its own clearly labeled section. */
export function PaymentMethodAnalyticsTab({ methods, range }: { methods: PaymentMethodBreakdownRow[]; range: DateRange }) {
  const [depth, setDepth] = useState<PaymentDepthData | null>(null);
  const [cash, setCash] = useState<CashComparison | null>(null);

  const load = useCallback(async () => {
    const [depthResult, cashResult] = await Promise.all([getPaymentDepthData(range), getCashComparison()]);
    if (depthResult.error !== null) {
      toast.error(depthResult.error);
    } else {
      setDepth(depthResult.data);
    }
    if (cashResult.error === null) setCash(cashResult.data);
  }, [range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching card/UPI/cash depth when the period range changes
    load();
  }, [load]);

  if (methods.length === 0) {
    return <EmptyState title="No payment method data yet" description="Expenses with a payment method logged in this period will show up here." variant="chart" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By payment method</h3>
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
                <ShareBar pct={pct} />
              </div>
            );
          })}
        </div>
      </div>

      {depth && depth.cardBreakdown.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By card</h3>
          {depth.mostUsedCard && (
            <p className="mb-2 text-xs text-muted-foreground">
              Most used: <strong className="text-foreground">{depth.mostUsedCard.card_label}</strong>
              {depth.mostUsedCard.last4 ? ` •••• ${depth.mostUsedCard.last4}` : ""}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {depth.cardBreakdown.map((c) => (
              <div key={c.card_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {c.card_label}
                    {c.last4 ? ` •••• ${c.last4}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.txn_count} transaction{c.txn_count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">{formatINR(c.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {depth && depth.upiBreakdown.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By UPI app</h3>
          {depth.mostUsedUpi && (
            <p className="mb-2 text-xs text-muted-foreground">
              Most used: <strong className="text-foreground">{depth.mostUsedUpi.label}</strong>
            </p>
          )}
          <div className="flex flex-col gap-3">
            {depth.upiBreakdown.map((u) => (
              <div key={u.upi_profile_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{u.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.txn_count} transaction{u.txn_count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">{formatINR(u.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {cash && (cash.thisMonth.txnCount > 0 || cash.lastMonth.txnCount > 0) && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash: this month vs last month</h3>
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Banknote className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="flex flex-1 items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">This month</p>
                  <p className="text-sm font-bold text-foreground">{formatINR(cash.thisMonth.total)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Last month</p>
                  <p className="text-sm font-bold text-foreground">{formatINR(cash.lastMonth.total)}</p>
                </div>
                {cash.changePct !== null && (
                  <p className={cn("text-xs font-medium", cash.changePct <= 0 ? "text-brand-green" : "text-brand-orange")}>
                    {cash.changePct > 0 ? "+" : ""}
                    {cash.changePct.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
