"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  CalendarDays,
  Repeat,
  Users,
  ArrowDown,
  ArrowUp,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Layers,
  ShoppingBag,
  Store,
  Tag,
} from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getSpendingIntelligence,
  type SpendingIntelligenceData,
  type RankedChange,
} from "@/lib/actions/spending-intelligence";
import {
  getTodayRange,
  getLast7DaysRange,
  getLast30DaysRange,
  getMonthRange,
  getPreviousMonthRange,
  type DateRange,
} from "@/lib/date-utils";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

const QUICK_RANGES = [
  { key: "month", label: "This Month", get: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last Month", get: getPreviousMonthRange },
  { key: "30d", label: "30 Days", get: getLast30DaysRange },
  { key: "7d", label: "7 Days", get: getLast7DaysRange },
  { key: "today", label: "Today", get: getTodayRange },
] as const;

function MetricHeroCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeType = "neutral",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
  badgeType?: "success" | "warning" | "neutral" | "info";
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-surface p-4 shadow-sm transition-all hover:border-border hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3">
        <p className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{value}</p>
        {(subtitle || badge) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {badge && (
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  badgeType === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  badgeType === "warning" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  badgeType === "info" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  badgeType === "neutral" && "bg-muted text-foreground"
                )}
              >
                {badge}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-surface p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

function ChangeRow({
  change,
  maxAmount = 1,
}: {
  change: RankedChange;
  maxAmount?: number;
}) {
  const isDrop = change.current <= change.previous;
  const progressPct = Math.min(100, Math.max(8, (change.current / Math.max(maxAmount, 1)) * 100));

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{change.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-foreground">{formatINR(change.current)}</span>
          {change.changePct !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                isDrop
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {isDrop ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />}
              {Math.abs(change.changePct).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Visual bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isDrop ? "bg-emerald-500/80" : "bg-primary"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Spending Intelligence: Advanced financial analytics dashboard.
 * Provides velocity gauges, weekday rhythm heatmaps, payer split,
 * category & merchant movers, and automated smart takeaways.
 */
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

  const hasActivity = data ? data.summary.txnCount > 0 || data.personSplit.byPayer.length > 0 : false;
  const maxWeekdaySpend = data
    ? Math.max(...data.weekdayBreakdown.map((w) => w.total), 1)
    : 1;

  const maxCategorySpend = data?.categoryChanges?.changes
    ? Math.max(...data.categoryChanges.changes.map((c) => c.current), 1)
    : 1;

  const maxMerchantSpend = data?.topMerchantChanges
    ? Math.max(...data.topMerchantChanges.map((m) => m.current), 1)
    : 1;

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/analytics" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Spending Intelligence</h1>
            <p className="text-xs text-muted-foreground">Velocity, rhythm, movers &amp; household split</p>
          </div>
        </div>
      </div>

      {/* Quick Range Filter Bar */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => handleRangeChange(r.key, r.get())}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all",
              rangeKey === r.key
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/80 bg-surface text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
          ))}
          <div className="h-44 animate-pulse rounded-2xl bg-muted/60 sm:col-span-2 lg:col-span-4" />
        </div>
      ) : !data || !hasActivity ? (
        <EmptyState
          title="Nothing to analyze yet"
          description="Once there's spending logged in this period, deep patterns and intelligence will show up here."
          variant="chart"
        />
      ) : (
        <>
          {/* Hero Metrics (4 Cards Grid) */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricHeroCard
              title="Total Spending"
              value={formatINR(data.summary.total)}
              subtitle={data.summary.changePct !== null ? "vs previous period" : `${data.summary.txnCount} transactions`}
              icon={TrendingUp}
              badge={
                data.summary.changePct !== null
                  ? `${data.summary.changePct > 0 ? "+" : ""}${data.summary.changePct.toFixed(0)}%`
                  : undefined
              }
              badgeType={
                data.summary.changePct !== null
                  ? data.summary.changePct <= 0
                    ? "success"
                    : "warning"
                  : "neutral"
              }
            />

            <MetricHeroCard
              title="Daily Spend Velocity"
              value={formatINR(data.avgDailySpend)}
              subtitle={
                data.projectedMonthEnd
                  ? `Est. ${formatINR(data.projectedMonthEnd)} month end`
                  : `${formatINR(data.avgWeeklySpend)} / week`
              }
              icon={Zap}
              badge={data.projectedMonthEnd ? "On Track" : "Avg Pace"}
              badgeType="info"
            />

            <MetricHeroCard
              title="Average Ticket Size"
              value={formatINR(data.summary.avgTransaction)}
              subtitle={`across ${data.summary.txnCount} purchases`}
              icon={Activity}
            />

            <MetricHeroCard
              title="Peak Spending Activity"
              value={data.weekdayPeak ? data.weekdayPeak.weekdayName : data.datePeak ? formatINR(data.datePeak.total) : "-"}
              subtitle={
                data.weekdayPeak
                  ? `${formatINR(data.weekdayPeak.total)} total`
                  : data.datePeak
                  ? new Date(data.datePeak.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : undefined
              }
              icon={CalendarDays}
              badge="Peak Day"
              badgeType="warning"
            />
          </div>

          {/* Smart Takeaways Box */}
          {data.smartTakeaways.length > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>Smart Insights &amp; Takeaways</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs font-medium text-foreground sm:text-sm">
                {data.smartTakeaways.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weekday Rhythm & Distribution */}
          <SectionCard
            title="Weekly Spending Rhythm"
            subtitle="Distribution of spend across each day of the week"
            icon={CalendarDays}
            badge={
              data.weekdayPeak && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Peak: {data.weekdayPeak.weekdayName}
                </span>
              )
            }
          >
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {data.weekdayBreakdown.map((day) => {
                const heightPct = Math.min(100, Math.max(10, (day.total / maxWeekdaySpend) * 100));
                const isPeak = data.weekdayPeak?.weekdayName === day.weekdayName && day.total > 0;

                return (
                  <div key={day.weekdayNum} className="flex flex-col items-center gap-1.5">
                    {/* Amount on top (sm+) */}
                    <span className="hidden text-[10px] font-semibold text-muted-foreground sm:block">
                      {day.total > 0 ? formatINR(day.total) : "-"}
                    </span>

                    {/* Bar Container */}
                    <div className="flex h-28 w-full max-w-[42px] flex-col justify-end rounded-xl bg-muted/40 p-1">
                      <div
                        className={cn(
                          "w-full rounded-lg transition-all duration-500",
                          isPeak
                            ? "bg-amber-500 shadow-sm shadow-amber-500/30"
                            : day.total > 0
                            ? "bg-primary/80"
                            : "bg-transparent"
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Day label */}
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        isPeak ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}
                    >
                      {day.shortName}
                    </span>

                    {/* Share pct */}
                    <span className="text-[10px] text-muted-foreground">
                      {day.sharePct > 0 ? `${day.sharePct.toFixed(0)}%` : "0%"}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* 2-Column Grid for Payer Split & Household Split */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Payer Split Card */}
            <SectionCard title="Spending by Payer" subtitle="Contribution per household member" icon={Users}>
              <div className="space-y-3.5">
                {/* Visual combined split bar */}
                {data.personSplit.byPayer.length >= 2 && (
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                    {data.personSplit.byPayer.map((payer, idx) => {
                      const share = data.summary.total > 0 ? (payer.total / data.summary.total) * 100 : 50;
                      return (
                        <div
                          key={payer.userId}
                          className={cn(
                            "h-full transition-all duration-500",
                            idx === 0 ? "bg-primary" : "bg-emerald-500"
                          )}
                          style={{ width: `${share}%` }}
                          title={`${payer.name}: ${share.toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="divide-y divide-border/50">
                  {data.personSplit.byPayer.map((payer, idx) => {
                    const share = data.summary.total > 0 ? (payer.total / data.summary.total) * 100 : 0;
                    return (
                      <div key={payer.userId} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              idx === 0 ? "bg-primary" : "bg-emerald-500"
                            )}
                          />
                          <div>
                            <p className="text-xs font-bold text-foreground">{payer.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {payer.txnCount} txns · avg {formatINR(payer.avgTransaction)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">{formatINR(payer.total)}</p>
                          <p className="text-[11px] font-semibold text-muted-foreground">{share.toFixed(0)}% share</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>

            {/* Household vs Personal Split Card */}
            <SectionCard title="Household vs Personal" subtitle="Shared living vs individual expenses" icon={Layers}>
              <div className="space-y-3">
                {data.personSplit.byExpenseType.map((type) => (
                  <div key={type.expenseType} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize text-foreground">{type.expenseType}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{formatINR(type.total)}</span>
                        <span className="text-[11px] font-medium text-muted-foreground">({type.sharePct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, type.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Recurring vs One-Off Stability Card */}
          <SectionCard
            title="Recurring vs One-Off Spending"
            subtitle="Fixed recurring commitments vs discretionary one-off transactions"
            icon={Repeat}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Recurring Bills</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {data.recurringVsOneoff.recurringSharePct.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-lg font-extrabold text-foreground">
                  {formatINR(data.recurringVsOneoff.recurringTotal)}
                </p>
                <p className="text-[11px] text-muted-foreground">{data.recurringVsOneoff.recurringCount} recurring payments</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">One-Off Spending</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {(100 - data.recurringVsOneoff.recurringSharePct).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-lg font-extrabold text-foreground">
                  {formatINR(data.recurringVsOneoff.oneoffTotal)}
                </p>
                <p className="text-[11px] text-muted-foreground">{data.recurringVsOneoff.oneoffCount} one-time transactions</p>
              </div>
            </div>
          </SectionCard>

          {/* Category Movers vs Previous Period */}
          {data.categoryChanges && data.categoryChanges.changes.length > 0 && (
            <SectionCard
              title="Category Movers vs Previous Period"
              subtitle={data.categoryChanges.summary}
              icon={ShoppingBag}
            >
              <div className="space-y-1 divide-y divide-border/40">
                {data.categoryChanges.changes.map((c) => (
                  <ChangeRow
                    key={c.category_id}
                    change={{
                      name: c.category_name,
                      current: c.current,
                      previous: c.previous,
                      changePct: c.changePct,
                    }}
                    maxAmount={maxCategorySpend}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* 2-Column Grid for Merchant & Item Movers */}
          {(data.topMerchantChanges.length > 0 || data.topItemChanges.length > 0) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.topMerchantChanges.length > 0 && (
                <SectionCard
                  title="Top Merchant Movers"
                  subtitle="Shifts in merchant spending vs previous period"
                  icon={Store}
                >
                  <div className="space-y-1 divide-y divide-border/40">
                    {data.topMerchantChanges.map((m) => (
                      <ChangeRow key={m.name} change={m} maxAmount={maxMerchantSpend} />
                    ))}
                  </div>
                </SectionCard>
              )}

              {data.topItemChanges.length > 0 && (
                <SectionCard
                  title="Top Item Movers"
                  subtitle="Specific items with highest movement"
                  icon={Tag}
                >
                  <div className="space-y-1 divide-y divide-border/40">
                    {data.topItemChanges.map((i) => (
                      <ChangeRow
                        key={i.name}
                        change={{ ...i, name: i.name.charAt(0).toUpperCase() + i.name.slice(1) }}
                      />
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

