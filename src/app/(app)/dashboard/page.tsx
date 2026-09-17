import { Suspense } from "react";
import { getDashboardData } from "@/lib/actions/analytics";
import { getMonthRange } from "@/lib/date-utils";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false }, // private, authenticated screen - never indexed (spec section 24)
};


export default async function DashboardPage() {
  const range = getMonthRange(0);
  const result = await getDashboardData({ range, person: "household" });

  return (
    <Suspense>
      <DashboardPageClient initialData={result.data} />
    </Suspense>
  );
}
