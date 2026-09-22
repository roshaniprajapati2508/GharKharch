import { Suspense } from "react";
import { getExpenses, getExpensesKpiSummary } from "@/lib/actions/expenses";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { ExpensesPageClient } from "@/components/expenses/expenses-page-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expenses",
  robots: { index: false, follow: false }, // private, authenticated screen - never indexed (spec section 24)
};

export default async function ExpensesPage() {
  const [expensesResult, categoriesResult, kpiResult] = await Promise.all([
    getExpenses(),
    listCategoriesForHousehold(),
    getExpensesKpiSummary(),
  ]);

  return (
    <Suspense>
      <ExpensesPageClient
        initialExpenses={expensesResult.data ?? []}
        categories={categoriesResult.data?.tree ?? []}
        initialKpi={kpiResult.data ?? null}
      />
    </Suspense>
  );
}

