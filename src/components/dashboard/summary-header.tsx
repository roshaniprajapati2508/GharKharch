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
import { getMonthRange, type DateRange } from "@/lib/date-utils";
import type { QuickPeriod } from "@/components/dashboard/dashboard-filters";
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
  period?: QuickPeriod;
  range?: DateRange;
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
  period = "month",
  range,
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
      const activeRange = range ?? getMonthRange();
      const [cashflowRes, paceRes, briefRes, recRes] = await Promise.all([
        getExecutiveCashflow({ start: activeRange.start, end: activeRange.end }),
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
    loadSupportingData();
    // Re-run whenever the selected date range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start, range?.end]);

  useOnExpenseSaved(loadSupportingData);

  const frequentMerchant = mostFrequentMerchant(topMerchants);
  const highestDay = highestSpendingDayLabel(dailySpending);

  // Cashflow calculations for the active range
  const totalInflow = cashflow ? cashflow.totalInflow : 0;
  const totalOutflow = cashflow ? cashflow.totalOutflow : total;
  const netSavings = cashflow ? cashflow.netSavings : (totalInflow - total);
  const isSavingsPositive = netSavings >= 0;

  // Pace calculations
  const projectedMonthEnd = pace ? pace.projectedMonthEnd : total;
  const pacePct = pace && pace.avg6mMtdSpend > 0 ? Math.round(((pace.currentMtdSpend - pace.avg6mMtdSpend) / pace.avg6mMtdSpend) * 100) : 0;
  const isPaceFrugal = pacePct <= -5;
  const isPaceElevated = pacePct >= 10;

  // Dynamic titles based on selected period
  const spendCardTitle = (() => {
    if (period === "today") return "Aaj Ka Kharcha (Today's Spend)";
    if (period === "7d") return "Pichhle 7 Din Ka Kharcha";
    if (period === "30d") return "Pichhle 30 Din Ka Kharcha";
    if (period === "month") return "Is Mahine Ka Kharcha";
    if (period === "lastMonth") return "Pichhle Mahine Ka Kharcha";
    return "Kul Kharcha (Total Spend)";
  })();

  const incomeCardTitle = (() => {
    if (period === "today") return "Aaj Ki Kamai (Income / Aaya)";
    if (period === "month") return "Is Mahine Ki Kamai";
    return "Kul Kamai (Income / Aaya)";
  })();

  const savingsCardTitle = (() => {
    if (period === "today") return "Aaj Ki Bachat (Net In Hand)";
    if (period === "month") return "Is Mahine Ki Bachat";
    return "Kul Bachat (Net Savings)";
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* 4-Column Desi Couple KPI Bento Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Spend (Kharcha) */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 text-brand-primary" /> {spendCardTitle}
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
                {Math.abs(change).toFixed(0)}% {change <= 0 ? "kam" : "zyada"}
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatINR(total)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              {period === "today" ? (
                <>
                  <span>Entries: <strong className="font-semibold text-foreground">{summary.txn_count} kharche</strong></span>
                  <span>Pura din</span>
                </>
              ) : (
                <>
                  <span>Roz ka average: <strong className="font-semibold text-foreground">{formatINR(dailyAvg)}</strong></span>
                  <span>{summary.txn_count} transaction{summary.txn_count === 1 ? "" : "s"}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Kamai / Income (Aaya Hua Paisa) */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <PiggyBank className="h-3.5 w-3.5 text-indigo-500" /> {incomeCardTitle}
            </span>
            {totalInflow > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                +{formatINR(totalInflow)}
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums sm:text-3xl">
              +{formatINR(totalInflow)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {cashflow?.incomeByCategory?.length ? `${cashflow.incomeByCategory.length} income sources` : "Kamai / Aaya"}
              </span>
              <span>Inflow</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Bachat / Savings (Haath Me Bacha) */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {savingsCardTitle}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
                isSavingsPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {isSavingsPositive ? "Bachat hui 🎉" : "Kharcha zyada ⚠️"}
            </span>
          </div>
          <div className="mt-3">
            <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl", isSavingsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {isSavingsPositive ? "+" : ""}{formatINR(netSavings)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aaya: +{formatINR(totalInflow)}</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">Gaya: -{formatINR(total > 0 ? total : totalOutflow)}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Mahine Ka Andaaza (Month Forecast & Status) */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-amber-500" /> Mahine Ka Andaaza
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
              {isPaceFrugal ? "Kharcha kam hai 👍" : isPaceElevated ? "Thoda sambhalke ⚠️" : "Control me hai 👌"}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-3xl">
              ~{formatINR(projectedMonthEnd)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span>Ab tak kharcha: <strong className="font-semibold text-foreground">{formatINR(pace?.currentMtdSpend ?? total)}</strong></span>
              <span>{pace ? `Din ${pace.currentDay}/${pace.daysInMonth}` : "Yeh mahina"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Strip */}
      {(frequentMerchant || highestDay) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Khas baatein (Highlights):
          </span>
          {frequentMerchant && (
            <span>
              Sabse zyada visit: <strong className="font-semibold text-foreground">{frequentMerchant.merchant_name}</strong> ({frequentMerchant.txn_count} purchases)
            </span>
          )}
          {highestDay && (
            <span>
              Sabse zyada kharch ka din: <strong className="font-semibold text-foreground">{highestDay}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
