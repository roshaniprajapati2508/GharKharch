import { Suspense } from "react";
import { getDashboardData } from "@/lib/actions/analytics";
import { getDailyWeeklySnapshot, getSpendingChanges, getHouseholdForecast } from "@/lib/actions/insights";
import { getRecurringSummary } from "@/lib/actions/recurring";
import { getQuickAddChips } from "@/lib/actions/quick-add";
import { getMonthRange } from "@/lib/date-utils";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false }, // private, authenticated screen - never indexed (spec section 24)
};

export default async function DashboardPage() {
  const range = getMonthRange(0);
  const [result, snapshotRes, changesRes, recurringRes, chipsRes, forecastRes] = await Promise.all([
    getDashboardData({ range, person: "household" }),
    getDailyWeeklySnapshot(),
    getSpendingChanges(),
    getRecurringSummary(),
    getQuickAddChips(4),
    getHouseholdForecast(),
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
        initialChips={chipsRes.data ?? []}
        initialForecast={forecastRes.data ?? null}
      />
    </Suspense>
  );
}
