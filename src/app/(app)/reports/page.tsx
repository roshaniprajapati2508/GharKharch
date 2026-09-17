import { Suspense } from "react";
import { getReportData } from "@/lib/actions/reports";
import { getMonthRange } from "@/lib/date-utils";
import { ReportsPageClient } from "@/components/reports/reports-page-client";

export default async function ReportsPage() {
  const range = getMonthRange(0);
  const result = await getReportData(range);

  return (
    <Suspense>
      <ReportsPageClient initialData={result.data} />
    </Suspense>
  );
}
