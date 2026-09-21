"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Clock } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { getDailyWeeklySnapshot, getSpendingChanges, type DailyWeeklySnapshot, type SpendingChangesResult } from "@/lib/actions/insights";
import { getRecurringSummary, type RecurringWithCategory } from "@/lib/actions/recurring";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export interface BriefData {
  snapshot: DailyWeeklySnapshot;
  changes: SpendingChangesResult | null;
  nextRecurring: RecurringWithCategory | null;
}

/**
 * "Read this once a day" digest - today/week snapshot, this-month's category
 * movers, and the soonest-due recurring bill.
 */
export function DailyBriefCard({
  initialData,
}: {
  initialData?: BriefData | null;
} = {}) {
  const [data, setData] = useState<BriefData | null>(initialData ?? null);
  const [loaded, setLoaded] = useState(initialData !== undefined);

  const load = useCallback(() => {
    Promise.all([getDailyWeeklySnapshot(), getSpendingChanges(), getRecurringSummary()]).then(
      ([snapshotRes, changesRes, recurringRes]) => {
        if (snapshotRes.error === null) {
          setData({
            snapshot: snapshotRes.data,
            changes: changesRes.error === null ? changesRes.data : null,
            nextRecurring: recurringRes.error === null ? recurringRes.data.upcoming[0] ?? null : null,
          });
        }
        setLoaded(true);
      }
    );
  }, []);

  useEffect(() => {
    if (initialData === undefined) {
      load();
    }
  }, [initialData, load]);

  useOnExpenseSaved(load);

  if (!loaded || !data) return null;

  const { snapshot, changes, nextRecurring } = data;
  const hasChange = snapshot.weekChangePct !== null;
  const isDown = hasChange && (snapshot.weekChangePct as number) <= 0;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-4.5 shadow-xs backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-brand-primary" /> {greeting()}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Today</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {formatINR(snapshot.todayTotal)}
          </p>
          <p className="text-[11px] text-muted-foreground">{snapshot.todayCount} expense{snapshot.todayCount === 1 ? "" : "s"} logged</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">This week</p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-bold tabular-nums text-foreground">
            {formatINR(snapshot.weekTotal)}
            {hasChange && (
              <span className={cn("inline-flex items-center text-[11px] font-bold", isDown ? "text-brand-green" : "text-brand-orange")}>
                {isDown ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {Math.abs(snapshot.weekChangePct as number).toFixed(0)}%
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">7-day rolling total</p>
        </div>
      </div>

      {changes && changes.changes.length > 0 && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">{changes.summary}</p>
      )}

      {nextRecurring && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 truncate text-xs text-foreground font-medium">
              <span>{nextRecurring.name}</span>
              {nextRecurring.next_due_date && (
                <span className="text-muted-foreground">
                  {" "}
                  &middot; due {new Date(nextRecurring.next_due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">{formatINR(Number(nextRecurring.amount))}</span>
        </div>
      )}
    </div>
  );
}
