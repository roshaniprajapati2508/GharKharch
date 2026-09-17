"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardFilters, type QuickPeriod } from "@/components/dashboard/dashboard-filters";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { CategoryAnalyticsTab } from "@/components/analytics/category-analytics-tab";
import { MerchantAnalyticsTab } from "@/components/analytics/merchant-analytics-tab";
import { ItemAnalyticsTab } from "@/components/analytics/item-analytics-tab";
import { SpendingCalendar } from "@/components/analytics/spending-calendar";
import { MonthlyComparisonCard } from "@/components/analytics/monthly-comparison-card";
import { TopExpensesList } from "@/components/analytics/top-expenses-list";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getAnalyticsData, type AnalyticsPageData, type PersonFilter } from "@/lib/actions/analytics";
import { getMonthRange, type DateRange } from "@/lib/date-utils";

export function AnalyticsPageClient() {
  const { openAdd } = useAddExpense();
  const [period, setPeriod] = useState<QuickPeriod>("month");
  const [range, setRange] = useState<DateRange>(getMonthRange(0));
  const [person, setPerson] = useState<PersonFilter>("household");
  const [data, setData] = useState<AnalyticsPageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextRange: DateRange, nextPerson: PersonFilter) => {
    setLoading(true);
    const result = await getAnalyticsData({ range: nextRange, person: nextPerson });
    setLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load(range, person);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(
    useCallback(() => {
      load(range, person);
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

  const hasActivity = data ? data.summary.txn_count > 0 : false;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>

      <DashboardFilters period={period} person={person} onPeriodChange={handlePeriodChange} onPersonChange={handlePersonChange} />

      {loading && !data ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !data || !hasActivity ? (
        <EmptyState
          title="Nothing to analyze yet"
          description="Spending trends, category breakdowns, and merchant insights arrive once there's real data to learn from."
          ctaLabel="Add an expense"
          onCta={openAdd}
          variant="chart"
        />
      ) : (
        <Tabs defaultValue="overview">
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="merchants">Merchants</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="flex flex-col gap-4">
            <SpendingTrendChart dailySpending={data.dailySpending} />
            <MonthlyComparisonCard
              range={data.range}
              previousRange={data.previousRange}
              summary={data.summary}
              previousSummary={data.previousSummary}
              categories={data.categoryBreakdown}
              previousCategories={data.previousCategoryBreakdown}
              merchants={data.merchantBreakdown}
              previousMerchants={data.previousMerchantBreakdown}
            />
            <TopExpensesList expenses={data.topExpenses} categories={data.categoryBreakdown} />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryAnalyticsTab
              categories={data.categoryBreakdown}
              previousCategories={data.previousCategoryBreakdown}
              grandTotal={parseFloat(data.summary.total)}
            />
          </TabsContent>

          <TabsContent value="merchants">
            <MerchantAnalyticsTab merchants={data.merchantBreakdown} />
          </TabsContent>

          <TabsContent value="items">
            <ItemAnalyticsTab items={data.itemAnalytics} previousItems={data.previousItemAnalytics} />
          </TabsContent>

          <TabsContent value="calendar">
            <SpendingCalendar />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
