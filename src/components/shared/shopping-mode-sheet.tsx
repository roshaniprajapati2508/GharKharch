"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryPicker, type CategorySelection } from "@/components/expenses/category-picker";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO } from "@/lib/date-utils";
import { createExpense } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { formatINR } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface ShoppingRow {
  key: string;
  itemName: string;
  amount: string;
  category: CategorySelection | null;
}

function emptyRow(carryOver: CategorySelection | null): ShoppingRow {
  return { key: crypto.randomUUID(), itemName: "", amount: "", category: carryOver };
}

/**
 * Multi-expense / "Shopping mode" (spec section 1): a lightweight repeating
 * row for rapidly adding several line items in one sitting — e.g. a grocery
 * run — without reopening the full Add Expense sheet for each item. Each row
 * defaults to the previous row's category (the household's category rarely
 * changes mid-grocery-run) so entry stays fast, but every row can still be
 * changed independently.
 *
 * CRITICAL: "Save all" loops over the existing `createExpense` action once
 * per row — each line item becomes its own real, individually
 * searchable/analyzable expense row, exactly as if it had been added one at
 * a time through the normal Add Expense sheet. Nothing here creates a
 * combined transaction or any new "session"/grouping table.
 */
export function ShoppingModeSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (expense: Tables<"expenses">) => void;
}) {
  const { userId } = useHousehold();
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [rows, setRows] = useState<ShoppingRow[]>([emptyRow(null)]);
  const [categoryPickerRowKey, setCategoryPickerRowKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    listCategoriesForHousehold().then((result) => {
      if (result.data) setCategoryTree(result.data.tree);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to one blank row each time the sheet opens fresh
    setRows([emptyRow(null)]);
  }, [open]);

  function updateRow(key: string, patch: Partial<ShoppingRow>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const last = rows[rows.length - 1];
    setRows((list) => [...list, emptyRow(last?.category ?? null)]);
  }

  function removeRow(key: string) {
    setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : list));
  }

  const validRows = rows.filter((r) => r.itemName.trim() && parseFloat(r.amount) > 0 && r.category);
  const total = validRows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  async function saveAll() {
    if (validRows.length === 0) {
      toast.error("Add at least one item with an amount and category");
      return;
    }
    setSaving(true);
    let savedCount = 0;
    for (const row of validRows) {
      const result = await createExpense({
        amount: parseFloat(row.amount),
        item_name: row.itemName.trim(),
        category_id: row.category!.categoryId,
        subcategory_id: row.category!.subcategoryId,
        merchant_id: null,
        paid_by: userId,
        expense_type: "household",
        expense_date: getTodayISO(),
      });
      if (result.error !== null) {
        toast.error(`Stopped after ${savedCount} saved — ${result.error}`);
        setSaving(false);
        setRows((list) => list.filter((r) => !validRows.slice(0, savedCount).some((saved) => saved.key === r.key)));
        return;
      }
      savedCount += 1;
      onSaved?.(result.data);
    }
    setSaving(false);
    toast.success(`${savedCount} expense${savedCount === 1 ? "" : "s"} added · ${formatINR(total)}`);
    onOpenChange(false);
  }

  const pickerRow = rows.find((r) => r.key === categoryPickerRowKey) ?? null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[94dvh]">
          <DrawerHeader>
            <DrawerTitle>Shopping mode</DrawerTitle>
            <DrawerDescription>Add several items quickly — each is saved as its own expense.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5">
            <div className="flex flex-col gap-2 pb-4">
              {rows.map((row, i) => (
                <div key={row.key} className="flex items-center gap-2 rounded-lg border border-input bg-surface p-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Input
                      value={row.itemName}
                      onChange={(e) => updateRow(row.key, { itemName: e.target.value })}
                      placeholder={`Item ${i + 1}, e.g. Milk`}
                      className="h-9"
                    />
                    <button
                      type="button"
                      onClick={() => setCategoryPickerRowKey(row.key)}
                      className="flex h-8 items-center gap-1 rounded-md bg-muted px-2 text-left text-xs text-muted-foreground"
                    >
                      <span className="truncate">
                        {row.category ? `${row.category.categoryName}${row.category.subcategoryName ? ` · ${row.category.subcategoryName}` : ""}` : "Choose category"}
                      </span>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </button>
                  </div>
                  <Input
                    value={row.amount}
                    onChange={(e) => updateRow(row.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                    inputMode="decimal"
                    placeholder="₹0"
                    className="h-9 w-20 text-right"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    aria-label="Remove item"
                    className="shrink-0 text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addRow} className="mt-1">
                <Plus className="h-4 w-4" /> Add another item
              </Button>
            </div>
          </div>

          <DrawerFooter>
            <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {validRows.length} expense{validRows.length === 1 ? "" : "s"}
              </span>
              <span className="font-semibold text-foreground">{formatINR(total)}</span>
            </div>
            <Button size="lg" onClick={saveAll} disabled={saving || validRows.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save all`}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <CategoryPicker
        open={!!categoryPickerRowKey}
        onOpenChange={(open) => !open && setCategoryPickerRowKey(null)}
        tree={categoryTree}
        onSelect={(selection) => {
          if (pickerRow) updateRow(pickerRow.key, { category: selection });
          setCategoryPickerRowKey(null);
        }}
        onCategoryCreated={(cat) => setCategoryTree((t) => [...t, cat])}
      />
    </>
  );
}
