"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpenseList } from "@/components/expenses/expense-list";
import { ExpenseFiltersSheet, type AppliedFilters } from "@/components/expenses/expense-filters-sheet";
import { ExpenseSearch } from "@/components/expenses/expense-search";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { getExpenses, softDeleteExpense, restoreExpense, duplicateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import { formatINR } from "@/lib/utils";
import { toastUndo } from "@/lib/toast-helpers";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

export function ExpensesPageClient({
  initialExpenses,
  categories,
}: {
  initialExpenses: EnrichedExpense[];
  categories: CategoryWithChildren[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [expenses, setExpenses] = useState(initialExpenses);
  const [filters, setFilters] = useState<AppliedFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(searchParams.get("focus") === "search");
  const [editTarget, setEditTarget] = useState<EnrichedExpense | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opening the search sheet based on the initial URL param
      setSearchOpen(true);
      router.replace("/expenses");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(async (nextFilters: AppliedFilters) => {
    setLoading(true);
    const result = await getExpenses(nextFilters);
    setLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setExpenses(result.data);
  }, []);

  useOnExpenseSaved(useCallback(() => refetch(filters), [refetch, filters]));

  function applyFilters(next: AppliedFilters) {
    setFilters(next);
    refetch(next);
  }

  function removeFilter(key: keyof AppliedFilters) {
    const next = { ...filters };
    delete next[key];
    if (key === "rangeKey") {
      delete next.start;
      delete next.end;
    }
    applyFilters(next);
  }

  async function handleDelete(expense: EnrichedExpense) {
    setExpenses((list) => list.filter((e) => e.id !== expense.id));
    const result = await softDeleteExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      setExpenses((list) => [expense, ...list]);
      return;
    }
    toastUndo(`${formatINR(expense.amount)} expense deleted`, async () => {
      const restored = await restoreExpense(expense.id);
      if (!restored.error) setExpenses((list) => [expense, ...list]);
    });
  }

  async function handleDuplicate(expense: EnrichedExpense) {
    const result = await duplicateExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Duplicated · ${formatINR(expense.amount)}`);
    refetch(filters);
  }

  const activeChips: { key: keyof AppliedFilters; label: string }[] = [];
  if (filters.rangeKey && filters.rangeKey !== "custom") {
    const rangeLabels: Record<string, string> = { today: "Today", "7d": "7D", "30d": "30D", month: "This Month", lastMonth: "Last Month" };
    activeChips.push({ key: "rangeKey", label: rangeLabels[filters.rangeKey] ?? filters.rangeKey });
  } else if (filters.start || filters.end) {
    activeChips.push({ key: "rangeKey", label: "Custom range" });
  }
  if (filters.categoryIds?.length) {
    activeChips.push({ key: "categoryIds", label: `${filters.categoryIds.length} categor${filters.categoryIds.length > 1 ? "ies" : "y"}` });
  }
  if (filters.paidBy && filters.paidBy !== "all") activeChips.push({ key: "paidBy", label: "Person" });
  if (typeof filters.minAmount === "number" || typeof filters.maxAmount === "number") activeChips.push({ key: "minAmount", label: "Amount" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => removeFilter(chip.key)}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <ExpenseList expenses={expenses} onEdit={setEditTarget} onDuplicate={handleDuplicate} onDelete={handleDelete} />
      )}

      <ExpenseFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} categories={categories} filters={filters} onApply={applyFilters} />
      <ExpenseSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AddExpenseSheet
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        editExpense={editTarget}
        onSaved={() => refetch(filters)}
      />
    </div>
  );
}
