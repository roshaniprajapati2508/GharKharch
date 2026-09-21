import { Suspense } from "react";
import { getDashboardData, getBusinessPnl } from "@/lib/actions/analytics";
import {
  getDailyWeeklySnapshot,
  getSpendingChanges,
  getHouseholdForecast,
  getCashflowSnapshot,
  getExecutiveCashflow,
  getSpendingPaceBenchmark,
} from "@/lib/actions/insights";
import { getRecentActivity } from "@/lib/actions/activity";
import { getRecurringSummary } from "@/lib/actions/recurring";
import { getMonthRange } from "@/lib/date-utils";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false }, // private, authenticated screen - never indexed (spec section 24)
};

export default async function DashboardPage() {
  const range = getMonthRange(0);

  // Consolidated parallel fetch across all dashboard widgets during SSR.
  // Because requireHouseholdContext is cached in React per-request, all of these
  // share the same single authenticated Supabase session, eliminating the client-side
  // post-mount HTTP POST stampede.
  const [
    result,
    snapshotRes,
    changesRes,
    recurringRes,
    forecastRes,
    cashflowRes,
    execCashflowRes,
    spendingPaceRes,
    activityRes,
    businessPnlRes,
  ] = await Promise.all([
    getDashboardData({ range, person: "household" }),
    getDailyWeeklySnapshot(),
    getSpendingChanges(),
    getRecurringSummary(),
    getHouseholdForecast(),
    getCashflowSnapshot(),
    getExecutiveCashflow({ start: range.start, end: range.end }),
    getSpendingPaceBenchmark(),
    getRecentActivity(10),
    getBusinessPnl(range),
  ]);

  const initialBrief = snapshotRes.data
    ? {
        snapshot: snapshotRes.data,
        changes: changesRes.data ?? null,
        nextRecurring: recurringRes.data?.upcoming?.[0] ?? null,
      }
    : null;

  return (
    <Suspense>
      <DashboardPageClient
        initialData={result.data}
        initialBrief={initialBrief}
        initialForecast={forecastRes.data ?? null}
        initialCashflow={cashflowRes.data ?? null}
        initialExecutiveCashflow={execCashflowRes.data ?? null}
        initialSpendingPace={spendingPaceRes.data ?? null}
        initialActivityEvents={activityRes.data ?? null}
        initialBusinessPnl={businessPnlRes.data ?? null}
      />
    </Suspense>
  );
}
