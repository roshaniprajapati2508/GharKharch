"use client";

import { useEffect, useState } from "react";
import {
  Receipt,
  ArrowDown,
  ArrowUp,
  PiggyBank,
  Gauge,
  Clock,
  CalendarDays,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { formatINR, percentChange, cn } from "@/lib/utils";
import { getExecutiveCashflow, getSpendingPaceBenchmark, getDailyWeeklySnapshot, type ExecutiveCashflow, type SpendingPaceBenchmark, type DailyWeeklySnapshot } from "@/lib/actions/insights";
import { getRecurringSummary, type RecurringWithCategory } from "@/lib/actions/recurring";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getMonthRange } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type ExpenseSummaryRow = Database["public"]["Functions"]["get_expense_summary"]["Returns"][number];
type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];

function highestSpendingDayLabel(daily: DailySpendingRow[]): string | null {
  if (daily.length === 0) return null;
  const top = daily.reduce((max, d) => (parseFloat(d.total) > parseFloat(max.total) ? d : max), daily[0]);
  if (parseFloat(top.total) === 0) return null;
  const date = new Date(`${top.expense_date}T00:00:00Z`);
  return date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

function mostFrequentMerchant(merchants: MerchantBreakdownRow[]): MerchantBreakdownRow | null {
  if (merchants.length === 0) return null;
  return merchants.reduce((max, m) => (m.txn_count > max.txn_count ? m : max), merchants[0]);
}

interface SummaryHeaderProps {
  periodLabel: string;
  summary: ExpenseSummaryRow;
  previousSummary: ExpenseSummaryRow;
  categoryBreakdown: CategoryBreakdownRow[];
  topMerchants: MerchantBreakdownRow[];
  dailySpending: DailySpendingRow[];
  initialCashflow?: ExecutiveCashflow | null;
  initialPace?: SpendingPaceBenchmark | null;
  initialBrief?: DailyWeeklySnapshot | null;
  initialNextRecurring?: RecurringWithCategory | null;
}

export function SummaryHeader({
  periodLabel,
  summary,
  previousSummary,
  categoryBreakdown,
  topMerchants,
  dailySpending,
  initialCashflow,
  initialPace,
  initialBrief,
  initialNextRecurring,
}: SummaryHeaderProps) {
  const total = parseFloat(summary.total);
  const prevTotal = parseFloat(previousSummary.total);
  const change = percentChange(total, prevTotal);
  const days = Math.max(summary.days, 1);
  const dailyAvg = total / days;

  const [cashflow, setCashflow] = useState<ExecutiveCashflow | null>(initialCashflow ?? null);
  const [pace, setPace] = useState<SpendingPaceBenchmark | null>(initialPace ?? null);
  const [brief, setBrief] = useState<DailyWeeklySnapshot | null>(initialBrief ?? null);
  const [nextRecurring, setNextRecurring] = useState<RecurringWithCategory | null>(initialNextRecurring ?? null);

  const loadSupportingData = async () => {
    try {
      const month = getMonthRange();
      const [cashflowRes, paceRes, briefRes, recRes] = await Promise.all([
        getExecutiveCashflow({ start: month.start, end: month.end }),
        getSpendingPaceBenchmark(),
        getDailyWeeklySnapshot(),
        getRecurringSummary(),
      ]);
      if (cashflowRes.data) setCashflow(cashflowRes.data);
      if (paceRes.data) setPace(paceRes.data);
      if (briefRes.data) setBrief(briefRes.data);
      if (recRes.data?.upcoming?.[0]) setNextRecurring(recRes.data.upcoming[0]);
    } catch {
      // best-effort metrics
    }
  };

  useEffect(() => {
    if (initialCashflow === undefined && initialPace === undefined) {
      loadSupportingData();
    }
  }, [initialCashflow, initialPace]);

  useOnExpenseSaved(loadSupportingData);

  const frequentMerchant = mostFrequentMerchant(topMerchants);
  const highestDay = highestSpendingDayLabel(dailySpending);

  // Cashflow calculations
  const netSavings = cashflow ? cashflow.netSavings : 0;
  const isSavingsPositive = netSavings >= 0;
  const totalInflow = cashflow ? cashflow.totalInflow : 0;
  const totalOutflow = cashflow ? cashflow.totalOutflow : total;

  // Pace calculations
  const projectedMonthEnd = pace ? pace.projectedMonthEnd : total;
  const pacePct = pace && pace.avg6mMtdSpend > 0 ? Math.round(((pace.currentMtdSpend - pace.avg6mMtdSpend) / pace.avg6mMtdSpend) * 100) : 0;
  const isPaceFrugal = pacePct <= -5;
  const isPaceElevated = pacePct >= 10;

  return (
    <div className="flex flex-col gap-4">
      {/* 4-Column Executive KPI Bento Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Outflow & Delta */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 text-brand-primary" /> Total Outflow
            </span>
            {change !== null && prevTotal > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  change <= 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                {change <= 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {Math.abs(change).toFixed(0)}% vs prev
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatINR(total)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span>Daily Run: <strong className="font-semibold text-foreground">{formatINR(dailyAvg)}</strong></span>
              <span>{summary.txn_count} transaction{summary.txn_count === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Net Cashflow & Inflow */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <PiggyBank className="h-3.5 w-3.5 text-indigo-500" /> Net Cashflow
            </span>
            {cashflow?.savingsRatePct !== null && cashflow?.savingsRatePct !== undefined && totalInflow > 0 && (
              <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {cashflow.savingsRatePct.toFixed(0)}% saved
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl", isSavingsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {isSavingsPositive ? "+" : ""}{formatINR(netSavings)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">In: +{formatINR(totalInflow)}</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">Out: -{formatINR(totalOutflow)}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Spending Pace & Month-End Forecast */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-amber-500" /> Month Forecast
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                isPaceFrugal
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isPaceElevated
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {isPaceFrugal ? <TrendingDown className="h-3 w-3" /> : isPaceElevated ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {isPaceFrugal ? "Frugal" : isPaceElevated ? "Elevated" : "On Track"}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-3xl">
              ~{formatINR(projectedMonthEnd)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span>MTD: <strong className="font-semibold text-foreground">{formatINR(total)}</strong></span>
              <span>{pace ? `Day ${pace.currentDay}/${pace.daysInMonth}` : "Current month"}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Daily Pulse & Soonest Due Bill */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-violet-500" /> Daily Pulse
            </span>
            {brief?.weekChangePct !== null && brief?.weekChangePct !== undefined && (
              <span className={cn("inline-flex items-center text-[11px] font-bold", brief.weekChangePct <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {brief.weekChangePct <= 0 ? "↓" : "↑"} {Math.abs(brief.weekChangePct).toFixed(0)}% 7D
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatINR(brief ? brief.todayTotal : 0)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              {nextRecurring ? (
                <span className="truncate flex items-center gap-1 text-foreground font-medium">
                  <CalendarDays className="h-3 w-3 text-brand-primary shrink-0" />
                  <span className="truncate">{nextRecurring.name}</span>
                  <span className="shrink-0 text-muted-foreground">({formatINR(Number(nextRecurring.amount))})</span>
                </span>
              ) : (
                <span>Today: {brief ? brief.todayCount : 0} expense{brief?.todayCount === 1 ? "" : "s"}</span>
              )}
              <span className="shrink-0">{brief ? `7D: ${formatINR(brief.weekTotal)}` : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Ribbon / Highlights */}
      {(frequentMerchant || highestDay) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Key highlights:
          </span>
          {frequentMerchant && (
            <span>
              Most frequent merchant: <strong className="font-semibold text-foreground">{frequentMerchant.merchant_name}</strong> ({frequentMerchant.txn_count} purchases)
            </span>
          )}
          {highestDay && (
            <span>
              Peak day: <strong className="font-semibold text-foreground">{highestDay}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
