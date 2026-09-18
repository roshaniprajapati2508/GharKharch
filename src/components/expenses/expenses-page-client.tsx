"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, X, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpenseList } from "@/components/expenses/expense-list";
import { BulkActionBar } from "@/components/expenses/bulk-action-bar";
import { ExpenseFiltersSheet, type AppliedFilters } from "@/components/expenses/expense-filters-sheet";
import { ExpenseSearch } from "@/components/expenses/expense-search";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import {
  getExpenses,
  softDeleteExpense,
  restoreExpense,
  duplicateExpense,
  updateExpenseField,
  bulkUpdateExpenses,
  bulkSoftDeleteExpenses,
  bulkRestoreExpenses,
  type EnrichedExpense,
  type InlineEditableField,
} from "@/lib/actions/expenses";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import { listPaymentMethodsForHousehold } from "@/lib/actions/payment-methods";
import { formatINR } from "@/lib/utils";
import { toastUndo } from "@/lib/toast-helpers";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import type { Tables } from "@/types/database";

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentMethods, setPaymentMethods] = useState<Tables<"payment_methods">[]>([]);

  useEffect(() => {
    listPaymentMethodsForHousehold().then((result) => {
      if (result.data) setPaymentMethods(result.data);
    });
  }, []);

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

  // Ultra-Fast CRM Power-Table (spec: Feature 3) - a single atomic patch
  // covers every inline-editable cell (double-click amount/item_name, plus
  // the desktop hover toolbar's category/payer/payment quick-switches).
  // updateExpenseField only returns the raw `expenses` row, not the
  // enriched display fields (category_name/icon/color, payer_name) this
  // list renders - so a category/paid_by change resolves those from data
  // already in memory (the `categories` prop, `useHousehold`'s userId/
  // partner) instead of a second round trip.
  async function handleInlineUpdate(expense: EnrichedExpense, field: InlineEditableField, value: string): Promise<boolean> {
    const previous = expenses;
    // 0ms optimistic update - apply immediately, roll back on failure.
    setExpenses((list) =>
      list.map((e) => {
        if (e.id !== expense.id) return e;
        if (field === "category_id") {
          const cat = categories.find((c) => c.id === value);
          return { ...e, category_id: value, subcategory_id: null, category_name: cat?.name ?? e.category_name, category_icon: cat?.icon ?? e.category_icon, category_color: cat?.color ?? e.category_color, subcategory_name: null };
        }
        return { ...e, [field]: field === "amount" ? value : value } as EnrichedExpense;
      })
    );

    const result = await updateExpenseField(expense.id, field, value);
    if (result.error !== null) {
      toast.error(result.error, { action: { label: "Undo", onClick: () => setExpenses(previous) } });
      setExpenses(previous);
      return false;
    }
    return true;
  }

  function handlePaidByChange(expense: EnrichedExpense, userId: string, label: string) {
    const previous = expenses;
    setExpenses((list) => list.map((e) => (e.id === expense.id ? { ...e, paid_by: userId, payer_name: label } : e)));
    updateExpenseField(expense.id, "paid_by", userId).then((result) => {
      if (result.error !== null) {
        toast.error(result.error);
        setExpenses(previous);
      }
    });
  }

  function toggleSelectExpense(expense: EnrichedExpense) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(expense.id)) next.delete(expense.id);
      else next.add(expense.id);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkCategoryChange(categoryId: string, categoryName: string) {
    const ids = Array.from(selectedIds);
    const result = await bulkUpdateExpenses(ids, { category_id: categoryId, subcategory_id: null });
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Moved ${ids.length} expense${ids.length === 1 ? "" : "s"} to ${categoryName}`);
    exitSelectionMode();
    refetch(filters);
  }

  async function handleBulkPaymentMethodChange(methodName: string) {
    const ids = Array.from(selectedIds);
    const result = await bulkUpdateExpenses(ids, { payment_method: methodName });
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Updated payment method for ${ids.length} expense${ids.length === 1 ? "" : "s"}`);
    exitSelectionMode();
    refetch(filters);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    const deleted = expenses.filter((e) => ids.includes(e.id));
    setExpenses((list) => list.filter((e) => !ids.includes(e.id)));
    exitSelectionMode();
    const result = await bulkSoftDeleteExpenses(ids);
    if (result.error !== null) {
      toast.error(result.error);
      setExpenses((list) => [...deleted, ...list]);
      return;
    }
    toastUndo(`${ids.length} expense${ids.length === 1 ? "" : "s"} deleted`, async () => {
      const restored = await bulkRestoreExpenses(ids);
      if (!restored.error) refetch(filters);
    });
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
  if (filters.merchantIds?.length) {
    activeChips.push({ key: "merchantIds", label: `${filters.merchantIds.length} merchant${filters.merchantIds.length > 1 ? "s" : ""}` });
  }
  if (typeof filters.minAmount === "number" || typeof filters.maxAmount === "number") activeChips.push({ key: "minAmount", label: "Amount" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <Button variant="outline" size="sm" onClick={exitSelectionMode}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                <ListChecks className="h-4 w-4" />
                Select
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                Filter
              </Button>
            </>
          )}
        </div>
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
        <ExpenseList
          expenses={expenses}
          onEdit={setEditTarget}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectExpense}
          onInlineUpdate={handleInlineUpdate}
          categories={categories}
          paymentMethods={paymentMethods}
          onPaidByChange={handlePaidByChange}
        />
      )}

      <BulkActionBar
        selectedExpenses={expenses.filter((e) => selectedIds.has(e.id))}
        categories={categories}
        onCategoryChange={handleBulkCategoryChange}
        onPaymentMethodChange={handleBulkPaymentMethodChange}
        onDelete={handleBulkDelete}
        onClose={exitSelectionMode}
      />

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
