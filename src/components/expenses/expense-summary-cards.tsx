"use client";

import { useMemo, useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Sparkles,
  Wallet,
  PiggyBank,
  Tag,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
} from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { CategoryIcon } from "@/lib/icon-map";
import type { ExpensesKpiSummary, EnrichedExpense } from "@/lib/actions/expenses";
import type { AppliedFilters } from "@/components/expenses/expense-filters-sheet";

interface ExpenseSummaryCardsProps {
  kpi: ExpensesKpiSummary | null;
  expenses: EnrichedExpense[];
  filters: AppliedFilters;
}

export function ExpenseSummaryCards({ kpi, expenses, filters }: ExpenseSummaryCardsProps) {
  // Mobile/desktop collapsible state (default expanded)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if any filter is actively applied
  const hasActiveFilters = Boolean(
    filters.rangeKey ||
    filters.start ||
    filters.end ||
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    (filters.merchantIds && filters.merchantIds.length > 0) ||
    (filters.paidBy && filters.paidBy !== "all") ||
    (filters.entryType && filters.entryType !== "all") ||
    filters.paymentMethod ||
    typeof filters.minAmount === "number" ||
    typeof filters.maxAmount === "number"
  );

  // User can toggle between Month Benchmark and Filtered Slice when filters are applied
  const [viewMode, setViewMode] = useState<"auto" | "benchmark">("auto");
  const isFilteredView = hasActiveFilters && viewMode === "auto";

  // Dynamic calculations from current displayed/filtered list
  const filteredMetrics = useMemo(() => {
    let spendTotal = 0;
    let spendCount = 0;
    let incomeTotal = 0;
    let incomeCount = 0;
    let highestItem: { name: string; amount: number } | null = null;
    const categoryTotals = new Map<string, { name: string; icon: string | null; color: string | null; total: number }>();

    for (const item of expenses) {
      const amt = parseFloat(String(item.amount || 0));
      if (item.entry_type === "income") {
        incomeTotal += amt;
        incomeCount += 1;
      } else {
        spendTotal += amt;
        spendCount += 1;
        if (!highestItem || amt > highestItem.amount) {
          highestItem = { name: item.item_name, amount: amt };
        }
        if (item.category_name) {
          const existing = categoryTotals.get(item.category_name) ?? {
            name: item.category_name,
            icon: item.category_icon,
            color: item.category_color,
            total: 0,
          };
          existing.total += amt;
          categoryTotals.set(item.category_name, existing);
        }
      }
    }

    let topCat: { name: string; icon: string | null; color: string | null; total: number } | null = null;
    for (const cat of categoryTotals.values()) {
      if (!topCat || cat.total > topCat.total) {
        topCat = cat;
      }
    }

    const net = incomeTotal - spendTotal;

    return {
      spendTotal,
      spendCount,
      incomeTotal,
      incomeCount,
      net,
      topCat,
      highestItem,
      totalCount: expenses.length,
    };
  }, [expenses]);

  if (!kpi && expenses.length === 0) {
    return null;
  }

  // Active numbers depending on view mode
  const currentExpense = isFilteredView ? filteredMetrics.spendTotal : (kpi?.totalExpense ?? filteredMetrics.spendTotal);
  const currentExpenseCount = isFilteredView ? filteredMetrics.spendCount : (kpi?.expenseCount ?? filteredMetrics.spendCount);
  const currentIncome = isFilteredView ? filteredMetrics.incomeTotal : (kpi?.totalIncome ?? filteredMetrics.incomeTotal);
  const currentIncomeCount = isFilteredView ? filteredMetrics.incomeCount : (kpi?.incomeCount ?? filteredMetrics.incomeCount);
  const currentNet = isFilteredView ? filteredMetrics.net : (kpi?.netCashflow ?? (currentIncome - currentExpense));

  const topCategoryName = isFilteredView
    ? (filteredMetrics.topCat?.name ?? "None")
    : (kpi?.topCategoryName ?? filteredMetrics.topCat?.name ?? "None");
  const topCategoryAmount = isFilteredView
    ? (filteredMetrics.topCat?.total ?? 0)
    : (kpi?.topCategoryAmount ?? filteredMetrics.topCat?.total ?? 0);
  const topCategoryIcon = isFilteredView
    ? (filteredMetrics.topCat?.icon ?? null)
    : (kpi?.topCategoryIcon ?? filteredMetrics.topCat?.icon ?? null);
  const topCategoryColor = isFilteredView
    ? (filteredMetrics.topCat?.color ?? null)
    : (kpi?.topCategoryColor ?? filteredMetrics.topCat?.color ?? null);
  const topCategoryPct = currentExpense > 0 ? Math.round((topCategoryAmount / currentExpense) * 100) : 0;

  // Render change badge
  const renderExpenseChangeBadge = () => {
    if (isFilteredView) {
      return (
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          {currentExpenseCount} txns in filter
        </span>
      );
    }
    if (kpi?.expenseChangePct === null || kpi?.expenseChangePct === undefined) {
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          {kpi?.dailyAvgExpense ? `₹${Math.round(kpi.dailyAvgExpense)}/day avg` : `${currentExpenseCount} txns`}
        </span>
      );
    }
    const isDown = kpi.expenseChangePct <= 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
          isDown ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50" : "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50"
        )}
      >
        {isDown ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        {Math.abs(Math.round(kpi.expenseChangePct))}% vs last mo
      </span>
    );
  };

  const renderIncomeChangeBadge = () => {
    if (isFilteredView) {
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          {currentIncomeCount} incoming txns
        </span>
      );
    }
    if (kpi?.incomeChangePct === null || kpi?.incomeChangePct === undefined) {
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          {kpi?.businessIncome ? `${formatINR(kpi.businessIncome)} LuxeKraft` : `${currentIncomeCount} receipts`}
        </span>
      );
    }
    const isUp = kpi.incomeChangePct >= 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
          isUp ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50" : "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50"
        )}
      >
        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(Math.round(kpi.incomeChangePct))}% vs last mo
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header bar with contextual mode switch & collapse toggle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <div className="flex items-center bg-muted/70 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode("auto")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5",
                  viewMode === "auto"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Filter className="h-3 w-3 text-brand-primary" />
                Filtered Slice ({filteredMetrics.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("benchmark")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5",
                  viewMode === "benchmark"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {kpi?.monthLabel ? `${kpi.monthLabel} Overview` : "Monthly"}
              </button>
            </div>
          ) : (
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-brand-primary" />
              {kpi?.monthLabel ? `${kpi.monthLabel} Overview` : "This Month"}
              {kpi?.daysElapsed ? (
                <span className="text-[10px] text-muted-foreground/80">
                  ({kpi.daysElapsed} of {kpi.daysInMonth} days)
                </span>
              ) : null}
            </span>
          )}
        </div>

        {/* Expand / Collapse Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50 transition-colors"
          title={isCollapsed ? "Expand summary cards" : "Collapse summary cards"}
        >
          <span>{isCollapsed ? "Show Summary" : "Collapse"}</span>
          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Collapsed Ribbon View (minimal height for high-efficiency browsing) */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border/70 shadow-xs cursor-pointer hover:border-brand-primary/40 transition-colors text-xs"
        >
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">Spent:</span>
              <span className="font-semibold text-foreground">{formatINR(currentExpense)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">In:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(currentIncome)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Net:</span>
              <span className={cn("font-semibold", currentNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {currentNet >= 0 ? `+${formatINR(currentNet)}` : formatINR(currentNet)}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-brand-primary font-medium hover:underline">Expand ⌵</span>
        </div>
      ) : (
        /* Full 4-Card Responsive Grid */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. Total Spent Card */}
          <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Total Spend</span>
              <div className="h-6 w-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {formatINR(currentExpense)}
              </div>
              <div className="mt-1.5 flex items-center justify-between flex-wrap gap-1">
                {renderExpenseChangeBadge()}
                {!isFilteredView && kpi?.dailyAvgExpense ? (
                  <span className="text-[10px] text-muted-foreground/80">
                    ₹{Math.round(kpi.dailyAvgExpense)}/d
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 2. Total Incoming Card */}
          <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Total Incoming</span>
              <div className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                +{formatINR(currentIncome)}
              </div>
              <div className="mt-1.5 flex items-center justify-between flex-wrap gap-1">
                {renderIncomeChangeBadge()}
                {!isFilteredView && kpi?.businessIncome ? (
                  <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[90px]" title={`LuxeKraft: ${formatINR(kpi.businessIncome)}`}>
                    {formatINR(kpi.businessIncome)} store
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 3. Net Cashflow / Savings Card */}
          <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Net Cash Flow</span>
              <div className="h-6 w-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <PiggyBank className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div
                className={cn(
                  "text-lg sm:text-xl font-bold tracking-tight",
                  currentNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {currentNet >= 0 ? `+${formatINR(currentNet)}` : formatINR(currentNet)}
              </div>
              <div className="mt-1.5 flex items-center justify-between flex-wrap gap-1">
                <span
                  className={cn(
                    "inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                    currentNet >= 0
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50"
                      : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50"
                  )}
                >
                  {currentNet >= 0 ? "Cash positive" : "Deficit"}
                </span>
                {!isFilteredView && kpi?.savingsRatePct !== null && kpi?.savingsRatePct !== undefined ? (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {Math.round(kpi.savingsRatePct)}% saved
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 4. Top Category Card */}
          <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Top Category</span>
              <div className="h-6 w-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Tag className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate flex items-center gap-1.5">
                <CategoryIcon icon={topCategoryIcon} color={topCategoryColor} className="h-4 w-4 shrink-0" />
                <span className="truncate" title={topCategoryName}>{topCategoryName}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between flex-wrap gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {formatINR(topCategoryAmount)}
                </span>
                {topCategoryPct > 0 ? (
                  <span className="inline-flex items-center text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                    {topCategoryPct}% of spend
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
