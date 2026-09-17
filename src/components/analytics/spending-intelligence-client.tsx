"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, CalendarDays, Repeat, Users, ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { getSpendingIntelligence, type SpendingIntelligenceData, type RankedChange } from "@/lib/actions/spending-intelligence";
import { getTodayRange, getLast7DaysRange, getLast30DaysRange, getMonthRange, getPreviousMonthRange, type DateRange } from "@/lib/date-utils";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

const QUICK_RANGES = [
  { key: "month", label: "This Month", get: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last Month", get: getPreviousMonthRange },
  { key: "30d", label: "30D", get: getLast30DaysRange },
  { key: "7d", label: "7D", get: getLast7DaysRange },
  { key: "today", label: "Today", get: getTodayRange },
] as const;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChangeRow({ change }: { change: RankedChange }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{change.name}</p>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-foreground">{formatINR(change.current)}</p>
        {change.changePct !== null && (
          <p className={cn("flex items-center justify-end gap-0.5 text-[11px] font-medium", change.current <= change.previous ? "text-brand-green" : "text-brand-orange")}>
            {change.current <= change.previous ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {Math.abs(change.changePct).toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  );
}

/** Spending Intelligence (batch phase): weekday/date peaks, average pace, person + expense-type split, recurring vs one-off, and the biggest category/merchant/item movers vs the previous comparable period. Built as its own page rather than a 7th Analytics tab — the tab bar already scrolls at 6, and this section leans on several independent RPCs (a heavier single fetch) that reads better as a distinct destination than another swipe-through tab. */
export function SpendingIntelligenceClient() {
  const [rangeKey, setRangeKey] = useState<string>("month");
  const [range, setRange] = useState<DateRange>(getMonthRange(0));
  const [data, setData] = useState<SpendingIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextRange: DateRange) => {
    setLoading(true);
    const result = await getSpendingIntelligence(nextRange);
    setLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(useCallback(() => load(range), [load, range]));

  function handleRangeChange(key: string, nextRange: DateRange) {
    setRangeKey(key);
    setRange(nextRange);
    load(nextRange);
  }

  const hasActivity = data ? data.personSplit.byPayer.length > 0 : false;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/analytics" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Spending Intelligence</h1>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => handleRangeChange(r.key, r.get())}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              rangeKey === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !data || !hasActivity ? (
        <EmptyState title="Nothing to analyze yet" description="Once there's spending logged in this period, patterns will show up here." variant="chart" />
      ) : (
        <>
          <SectionCard title="Spending pace">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Average per day</p>
                <p className="text-base font-bold text-foreground">{formatINR(data.avgDailySpend)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Average per week</p>
                <p className="text-base font-bold text-foreground">{formatINR(data.avgWeeklySpend)}</p>
              </div>
            </div>
          </SectionCard>

          {(data.weekdayPeak || data.datePeak) && (
            <SectionCard title="Peaks">
              <div className="flex flex-col gap-2.5">
                {data.weekdayPeak && (
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-foreground">
                      Highest-spending weekday: <strong>{data.weekdayPeak.weekdayName}</strong> ({formatINR(data.weekdayPeak.total)} total this period)
                    </p>
                  </div>
                )}
                {data.datePeak && (
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-foreground">
                      Highest-spending single date: <strong>{new Date(data.datePeak.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong> ({formatINR(data.datePeak.total)})
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Household vs personal">
            <div className="flex flex-col gap-2">
              {data.personSplit.byExpenseType.map((row) => (
                <div key={row.expenseType} className="flex items-center justify-between">
                  <p className="text-sm capitalize text-foreground">{row.expenseType}</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatINR(row.total)} <span className="text-xs text-muted-foreground">· {row.sharePct.toFixed(0)}%</span>
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By payer">
            <div className="flex flex-col gap-2">
              {data.personSplit.byPayer.map((row) => (
                <div key={row.userId} className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">{row.name}</p>
                  <p className="shrink-0 text-sm font-medium text-foreground">{formatINR(row.total)}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recurring vs one-off">
            <div className="flex items-center gap-2.5">
              <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">
                Recurring: <strong>{formatINR(data.recurringVsOneoff.recurringTotal)}</strong> ({data.recurringVsOneoff.recurringCount} txn) · One-off:{" "}
                <strong>{formatINR(data.recurringVsOneoff.oneoffTotal)}</strong> ({data.recurringVsOneoff.oneoffCount} txn)
              </p>
            </div>
          </SectionCard>

          {data.categoryChanges && data.categoryChanges.changes.length > 0 && (
            <SectionCard title="Category movers vs previous period">
              <p className="mb-1 text-xs text-muted-foreground">{data.categoryChanges.summary}</p>
              <div className="flex flex-col divide-y divide-border">
                {data.categoryChanges.changes.map((c) => (
                  <ChangeRow
                    key={c.category_id}
                    change={{ name: c.category_name, current: c.current, previous: c.previous, changePct: c.changePct }}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {data.topMerchantChanges.length > 0 && (
            <SectionCard title="Merchant movers vs previous period">
              <div className="flex flex-col divide-y divide-border">
                {data.topMerchantChanges.map((c) => (
                  <ChangeRow key={c.name} change={c} />
                ))}
              </div>
            </SectionCard>
          )}

          {data.topItemChanges.length > 0 && (
            <SectionCard title="Item movers vs previous period">
              <div className="flex flex-col divide-y divide-border">
                {data.topItemChanges.map((c) => (
                  <ChangeRow key={c.name} change={{ ...c, name: c.name.charAt(0).toUpperCase() + c.name.slice(1) }} />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
