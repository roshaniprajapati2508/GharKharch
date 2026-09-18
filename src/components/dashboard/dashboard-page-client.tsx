"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { useHousehold } from "@/lib/context/household-context";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { DashboardFilters, type QuickPeriod } from "@/components/dashboard/dashboard-filters";
import { SummaryHeader } from "@/components/dashboard/summary-header";
import { DailyBriefCard, type BriefData } from "@/components/dashboard/daily-brief-card";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { CategoryBreakdownList } from "@/components/dashboard/category-breakdown-list";
import { TopMerchantsCard } from "@/components/dashboard/top-merchants-card";
import { PersonComparisonCard } from "@/components/dashboard/person-comparison-card";
import { MostFrequentCard } from "@/components/dashboard/most-frequent-card";
import { TopExpensesList } from "@/components/analytics/top-expenses-list";
import { SpendingCalendar } from "@/components/analytics/spending-calendar";
import { DashboardBackgroundDecoration } from "@/components/dashboard/background-decoration";
import { InsightsList } from "@/components/dashboard/insights-list";
import { RecurringSuggestionsCard } from "@/components/dashboard/recurring-suggestions-card";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { MiniPnlCard } from "@/components/analytics/mini-pnl-card";
import { motion, staggerContainer, fadeInUp } from "@/lib/motion";
import { ExpenseList } from "@/components/expenses/expense-list";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { getDashboardData, type DashboardData, type PersonFilter } from "@/lib/actions/analytics";
import { softDeleteExpense, restoreExpense, duplicateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { toastUndo } from "@/lib/toast-helpers";
import { getMonthRange, type DateRange } from "@/lib/date-utils";
import { formatINR } from "@/lib/utils";
import { getClientCachedData, setClientCachedData, invalidateClientCache } from "@/lib/cache/client-cache";
import type { QuickAddChip } from "@/lib/actions/quick-add";
import type { HouseholdForecast } from "@/lib/actions/insights";

function getDashboardCacheKey(range: DateRange, person: PersonFilter) {
  return `dashboard_${range.start}_${range.end}_${person}`;
}

interface DashboardPageClientProps {
  initialData?: DashboardData | null;
  initialBrief?: BriefData | null;
  initialChips?: QuickAddChip[];
  initialForecast?: HouseholdForecast | null;
}

export function DashboardPageClient({
  initialData,
  initialBrief,
  initialChips,
  initialForecast,
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
    <div className="relative flex min-w-0 max-w-full flex-col gap-6 overflow-x-clip pb-10">
      <DashboardBackgroundDecoration />

      <div style={{ gridArea: "header" }}>
        <p className="text-sm text-muted-foreground">Good to see you, {displayName.split(" ")[0]} 👋</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{data?.range.label ?? range.label}</h1>
      </div>

      <DashboardFilters period={period} person={person} onPeriodChange={handlePeriodChange} onPersonChange={handlePersonChange} />

      {loading && !data ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : data && hasAnyActivity ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="dashboard-grid">
          <motion.div variants={fadeInUp} style={{ gridArea: "brief" }}>
            <DailyBriefCard initialData={initialBrief} initialChips={initialChips} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "forecast" }}>
            <ForecastCard initialForecast={initialForecast} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "summary" }}>
            <SummaryHeader
              periodLabel={data.range.label}
              summary={data.summary}
              previousSummary={data.previousSummary}
              categoryBreakdown={data.categoryBreakdown}
              topMerchants={data.topMerchants}
              dailySpending={data.dailySpending}
            />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "trend" }}>
            <SpendingTrendChart dailySpending={data.dailySpending} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "category" }}>
            <CategoryBreakdownList categories={data.categoryBreakdown} grandTotal={parseFloat(data.summary.total)} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "merchants" }}>
            <TopMerchantsCard merchants={data.topMerchants} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "person" }}>
            <PersonComparisonCard personBreakdown={data.personBreakdown} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "frequent" }}>
            <MostFrequentCard items={data.itemAnalytics} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "largest" }}>
            <TopExpensesList expenses={data.topExpenses.slice(0, 5)} categories={data.categoryBreakdown} />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "insights" }}>
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
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "recurring" }}>
            <RecurringSuggestionsCard />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "pnl" }}>
            <MiniPnlCard />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "activity" }}>
            <ActivityFeedCard />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "calendar" }}>
            <h3 className="mb-2 px-1 text-sm font-semibold text-foreground">Spending calendar</h3>
            <SpendingCalendar />
          </motion.div>

          <motion.div variants={fadeInUp} style={{ gridArea: "recent" }}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-foreground">Recent expenses</h3>
              <Link href="/expenses" className="flex items-center text-xs font-medium text-primary">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ExpenseList expenses={data.recentExpenses} onEdit={setEditTarget} onDuplicate={handleDuplicate} onDelete={handleDelete} />
          </motion.div>
        </motion.div>
      ) : (
        <EmptyState
          title="Your household spending story starts here."
          description="Once you add an expense, GharKharch starts building your spending picture - automatically."
          ctaLabel="Add your first expense"
          onCta={openAdd}
          chips={["Milk", "Groceries", "Petrol", "Shopping"]}
        />
      )}

      <AddExpenseSheet open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)} editExpense={editTarget} onSaved={() => load(range, person, true)} />
    </div>
  );
}
