"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { useHousehold } from "@/lib/context/household-context";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { DashboardFilters, type QuickPeriod } from "@/components/dashboard/dashboard-filters";
import { SummaryHeader } from "@/components/dashboard/summary-header";
import { FinancialHubCard } from "@/components/dashboard/financial-hub-card";
import { CategoryBreakdownList } from "@/components/dashboard/category-breakdown-list";
import { MerchantMemberCard } from "@/components/dashboard/merchant-member-card";
import { TopTransactionsCard } from "@/components/dashboard/top-transactions-card";
import { DashboardBackgroundDecoration } from "@/components/dashboard/background-decoration";
import { InsightsList } from "@/components/dashboard/insights-list";
import { RecurringSuggestionsCard } from "@/components/dashboard/recurring-suggestions-card";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { motion, staggerContainer, fadeInUp } from "@/lib/motion";
import { ExpenseList } from "@/components/expenses/expense-list";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { getDashboardData, type DashboardData, type PersonFilter } from "@/lib/actions/analytics";
import { softDeleteExpense, restoreExpense, duplicateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { toastUndo } from "@/lib/toast-helpers";
import { getMonthRange, type DateRange } from "@/lib/date-utils";
import { formatINR } from "@/lib/utils";
import { getClientCachedData, setClientCachedData, invalidateClientCache } from "@/lib/cache/client-cache";
import type { BriefData } from "@/components/dashboard/daily-brief-card";
import type { HouseholdForecast, CashflowSnapshot, ExecutiveCashflow, SpendingPaceBenchmark } from "@/lib/actions/insights";
import type { ActivityEvent } from "@/lib/actions/activity";
import type { BusinessPnl } from "@/lib/actions/analytics";

function getDashboardCacheKey(range: DateRange, person: PersonFilter) {
  return `dashboard_${range.start}_${range.end}_${person}`;
}

interface DashboardPageClientProps {
  initialData?: DashboardData | null;
  initialBrief?: BriefData | null;
  initialForecast?: HouseholdForecast | null;
  initialCashflow?: CashflowSnapshot | null;
  initialExecutiveCashflow?: ExecutiveCashflow | null;
  initialSpendingPace?: SpendingPaceBenchmark | null;
  initialActivityEvents?: ActivityEvent[] | null;
  initialBusinessPnl?: BusinessPnl | null;
}

export function DashboardPageClient({
  initialData,
  initialBrief,
  initialForecast,
  initialCashflow,
  initialExecutiveCashflow,
  initialSpendingPace,
  initialActivityEvents,
  initialBusinessPnl,
}: DashboardPageClientProps) {
  const { displayName } = useHousehold();
  const { openAdd } = useAddExpense();

  const [period, setPeriod] = useState<QuickPeriod>("month");
  const [range, setRange] = useState<DateRange>(initialData?.range ?? getMonthRange(0));
  const [person, setPerson] = useState<PersonFilter>("household");

  const [data, setData] = useState<DashboardData | null>(() => {
    if (initialData) {
      setClientCachedData(getDashboardCacheKey(initialData.range, "household"), initialData);
      return initialData;
    }
    return getClientCachedData<DashboardData>(getDashboardCacheKey(getMonthRange(0), "household"));
  });

  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<EnrichedExpense | null>(null);

  const load = useCallback(async (nextRange: DateRange, nextPerson: PersonFilter, forceFresh = false) => {
    const cacheKey = getDashboardCacheKey(nextRange, nextPerson);
    const cached = getClientCachedData<DashboardData>(cacheKey);

    if (cached && !forceFresh) {
      setData(cached);
    } else if (!cached && !data) {
      setLoading(true);
    }

    const result = await getDashboardData({ range: nextRange, person: nextPerson });
    setLoading(false);

    if (result.error !== null) {
      toast.error(result.error);
      return;
    }

    setClientCachedData(cacheKey, result.data);
    setData(result.data);
  }, [data]);

  useEffect(() => {
    if (!initialData && !data) {
      load(range, person);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(
    useCallback(() => {
      invalidateClientCache("dashboard_");
      load(range, person, true);
    }, [load, range, person])
  );

  function handlePeriodChange(nextPeriod: QuickPeriod, nextRange: DateRange) {
    setPeriod(nextPeriod);
    setRange(nextRange);
    load(nextRange, person);
  }

  function handlePersonChange(nextPerson: PersonFilter) {
    setPerson(nextPerson);
    load(range, nextPerson);
  }

  async function handleDelete(expense: EnrichedExpense) {
    if (!data) return;
    setData({ ...data, recentExpenses: data.recentExpenses.filter((e) => e.id !== expense.id) });
    invalidateClientCache("dashboard_");
    const result = await softDeleteExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      load(range, person, true);
      return;
    }
    toastUndo(`${formatINR(expense.amount)} expense deleted`, async () => {
      const restored = await restoreExpense(expense.id);
      if (!restored.error) load(range, person, true);
    });
  }

  async function handleDuplicate(expense: EnrichedExpense) {
    invalidateClientCache("dashboard_");
    const result = await duplicateExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Duplicated · ${formatINR(expense.amount)}`);
    load(range, person, true);
  }

  const hasAnyActivity = data ? data.summary.txn_count > 0 : false;

  return (
    <div className="relative flex min-w-0 max-w-full flex-col gap-6 overflow-x-clip pb-12">
      <DashboardBackgroundDecoration />

      {/* Modern Enterprise Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Good to see you, <span className="font-semibold text-foreground">{displayName.split(" ")[0]}</span> 👋
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
            {data?.range.label ?? range.label}
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAdd()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-primary/90 cursor-pointer active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <DashboardFilters
        period={period}
        person={person}
        onPeriodChange={handlePeriodChange}
        onPersonChange={handlePersonChange}
      />

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : data && hasAnyActivity ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
          {/* Executive KPI Bento Row (Top) */}
          <motion.div variants={fadeInUp}>
            <SummaryHeader
              periodLabel={data.range.label}
              summary={data.summary}
              previousSummary={data.previousSummary}
              categoryBreakdown={data.categoryBreakdown}
              topMerchants={data.topMerchants}
              dailySpending={data.dailySpending}
              initialCashflow={initialExecutiveCashflow}
              initialPace={initialSpendingPace}
              initialBrief={initialBrief?.snapshot}
              initialNextRecurring={initialBrief?.nextRecurring}
            />
          </motion.div>

          {/* Balanced 2-Column Responsive Workspace (8:4 Desktop Grid) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Primary Column (Analytics & Breakdown Hub - 8 Cols) */}
            <motion.div variants={fadeInUp} className="flex min-w-0 flex-col gap-6 lg:col-span-7 xl:col-span-8">
              {/* Main Financial Visualizer Hub (Spending Trend / P&L / Heatmap Calendar) */}
              <FinancialHubCard
                dailySpending={data.dailySpending}
                initialCashflow={initialCashflow}
                initialExecutiveCashflow={initialExecutiveCashflow}
                initialBusinessPnl={initialBusinessPnl}
              />

              {/* Spending Breakdown 2-Card Bento */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <CategoryBreakdownList
                  categories={data.categoryBreakdown}
                  grandTotal={parseFloat(data.summary.total)}
                />
                <MerchantMemberCard
                  merchants={data.topMerchants}
                  personBreakdown={data.personBreakdown}
                  itemAnalytics={data.itemAnalytics}
                />
              </div>

              {/* AI Spending Insights & Recurring Bills Strip */}
              <div className="flex flex-col gap-4">
                <InsightsList
                  data={{
                    range: data.range,
                    previousRange: data.previousRange,
                    summary: data.summary,
                    previousSummary: data.previousSummary,
                    categoryBreakdown: data.categoryBreakdown,
                    previousCategoryBreakdown: data.previousCategoryBreakdown,
                    merchantBreakdown: data.topMerchants,
                    itemAnalytics: data.itemAnalytics,
                    dailySpending: data.dailySpending,
                    topExpenses: data.topExpenses,
                  }}
                />
                <RecurringSuggestionsCard />
              </div>
            </motion.div>

            {/* Right Sidebar Column (Ledger & Activity Stream - 4 Cols) */}
            <motion.div variants={fadeInUp} className="flex min-w-0 flex-col gap-6 lg:col-span-5 xl:col-span-4">
              {/* Top Debits & Credits Card */}
              <TopTransactionsCard
                topExpenses={data.topExpenses}
                topInflows={data.topInflows}
                categories={data.categoryBreakdown}
              />

              {/* Recent Transactions Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-brand-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Recent expenses</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {data.recentExpenses.length}
                    </span>
                  </div>
                  <Link
                    href="/expenses"
                    className="flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    See all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="pt-2">
                  <ExpenseList
                    expenses={data.recentExpenses}
                    onEdit={setEditTarget}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                </div>
              </div>

              {/* Live Activity Audit Feed */}
              <ActivityFeedCard initialEvents={initialActivityEvents} />
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <EmptyState
          title="Your household spending story starts here."
          description="Once you add an expense, GharKharch starts building your spending picture - automatically."
          ctaLabel="Add your first expense"
          onCta={() => openAdd()}
          chips={["Milk", "Groceries", "Petrol", "Shopping"]}
        />
      )}

      <AddExpenseSheet
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        editExpense={editTarget}
        onSaved={() => load(range, person, true)}
      />
    </div>
  );
}
