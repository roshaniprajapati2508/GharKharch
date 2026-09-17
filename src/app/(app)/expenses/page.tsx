import { Suspense } from "react";
import { getExpenses } from "@/lib/actions/expenses";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { ExpensesPageClient } from "@/components/expenses/expenses-page-client";

export default async function ExpensesPage() {
  const [expensesResult, categoriesResult] = await Promise.all([getExpenses(), listCategoriesForHousehold()]);

  return (
    <Suspense>
      <ExpensesPageClient initialExpenses={expensesResult.data ?? []} categories={categoriesResult.data?.tree ?? []} />
    </Suspense>
  );
}
