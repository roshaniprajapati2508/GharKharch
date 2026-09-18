"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardFilters, type QuickPeriod } from "@/components/dashboard/dashboard-filters";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { CategoryAnalyticsTab } from "@/components/analytics/category-analytics-tab";
import { MerchantAnalyticsTab } from "@/components/analytics/merchant-analytics-tab";
import { ItemAnalyticsTab } from "@/components/analytics/item-analytics-tab";
import { PaymentMethodAnalyticsTab } from "@/components/analytics/payment-method-analytics-tab";
import { SpendingCalendar } from "@/components/analytics/spending-calendar";
import { MonthlyComparisonCard } from "@/components/analytics/monthly-comparison-card";
import { TopExpensesList } from "@/components/analytics/top-expenses-list";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getAnalyticsData, type AnalyticsPageData, type PersonFilter, type CategoryScope } from "@/lib/actions/analytics";
import { getMonthRange, type DateRange } from "@/lib/date-utils";
import { CategoryScopeToggle } from "@/components/shared/category-scope-toggle";
import { MiniPnlCard } from "@/components/analytics/mini-pnl-card";

import { getClientCachedData, setClientCachedData } from "@/lib/cache/client-cache";

const ANALYTICS_CACHE_KEY = "analytics_month_data";

export function AnalyticsPageClient({ initialData }: { initialData?: AnalyticsPageData | null }) {
  const { openAdd } = useAddExpense();
  const [period, setPeriod] = useState<QuickPeriod>("month");
  const [range, setRange] = useState<DateRange>(getMonthRange(0));
  const [person, setPerson] = useState<PersonFilter>("household");
  // All / Household Only / Business Only - separates everyday household
  // spend from the Homemade Business category tree (migration 020) so both
  // can be reviewed (or reported on) independently.
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("all");
  const [data, setData] = useState<AnalyticsPageData | null>(() => {
    if (initialData) {
      setClientCachedData(ANALYTICS_CACHE_KEY, initialData);
      return initialData;
    }
    return getClientCachedData<AnalyticsPageData>(ANALYTICS_CACHE_KEY) ?? null;
  });
  const [loading, setLoading] = useState(() => !initialData && !getClientCachedData<AnalyticsPageData>(ANALYTICS_CACHE_KEY));

  const load = useCallback(async (nextRange: DateRange, nextPerson: PersonFilter, nextScope: CategoryScope) => {
    const isDefaultMonth =
      nextRange.start === getMonthRange(0).start && nextRange.end === getMonthRange(0).end && nextPerson === "household" && nextScope === "all";
    if (isDefaultMonth) {
      const cached = getClientCachedData<AnalyticsPageData>(ANALYTICS_CACHE_KEY);
      if (cached) {
        setData(cached);
        setLoading(false);
      }
    }
    const result = await getAnalyticsData({ range: nextRange, person: nextPerson, categoryScope: nextScope });
    if (result.error !== null) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    setData(result.data);
    if (isDefaultMonth && result.data) {
      setClientCachedData(ANALYTICS_CACHE_KEY, result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load(range, person, categoryScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(
    useCallback(() => {
      load(range, person, categoryScope);
    }, [load, range, person, categoryScope])
  );

  function handlePeriodChange(nextPeriod: QuickPeriod, nextRange: DateRange) {
    setPeriod(nextPeriod);
    setRange(nextRange);
    load(nextRange, person, categoryScope);
  }

  function handlePersonChange(nextPerson: PersonFilter) {
    setPerson(nextPerson);
    load(range, nextPerson, categoryScope);
  }

  function handleScopeChange(nextScope: CategoryScope) {
    setCategoryScope(nextScope);
    load(range, person, nextScope);
  }

  const hasActivity = data ? data.summary.txn_count > 0 : false;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>

      <DashboardFilters period={period} person={person} onPeriodChange={handlePeriodChange} onPersonChange={handlePersonChange} />

      <CategoryScopeToggle value={categoryScope} onChange={handleScopeChange} />

      <MiniPnlCard range={range} />

      <Link
        href="/analytics/intelligence"
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3.5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Spending Intelligence</p>
          <p className="text-xs text-muted-foreground">Peaks, pace, and what changed vs the previous period</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

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
              <TabsTrigger value="payments">Payments</TabsTrigger>
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
            <MerchantAnalyticsTab merchants={data.merchantBreakdown} range={data.range} />
          </TabsContent>

          <TabsContent value="items">
            <ItemAnalyticsTab items={data.itemAnalytics} previousItems={data.previousItemAnalytics} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentMethodAnalyticsTab methods={data.paymentMethodBreakdown} range={data.range} />
          </TabsContent>

          <TabsContent value="calendar">
            <SpendingCalendar />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
