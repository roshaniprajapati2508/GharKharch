import { Suspense } from "react";
import { getAnalyticsData } from "@/lib/actions/analytics";
import { getMonthRange } from "@/lib/date-utils";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false }, // private, authenticated screen - never indexed (spec section 24)
};


export default async function AnalyticsPage() {
  const range = getMonthRange(0);
  const result = await getAnalyticsData({ range, person: "household" });

  return (
    <Suspense>
      <AnalyticsPageClient initialData={result.data} />
    </Suspense>
  );
}
