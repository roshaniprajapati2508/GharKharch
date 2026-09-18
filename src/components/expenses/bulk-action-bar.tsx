"use client";

import { useEffect, useState } from "react";
import { Tag, CreditCard, Trash2, Download, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { listPaymentMethodsForHousehold } from "@/lib/actions/payment-methods";
import { formatINR } from "@/lib/utils";
import type { EnrichedExpense } from "@/lib/actions/expenses";
import type { CategoryWithChildren } from "@/lib/actions/categories";

/**
 * Floating bulk-action bar for the Expenses screen's multi-select mode
 * (spec: Pillar 4). Renders nothing when nothing is selected, so mounting it
 * unconditionally in the parent is fine.
 */
export function BulkActionBar({
  selectedExpenses,
  categories,
  onCategoryChange,
  onPaymentMethodChange,
  onDelete,
  onClose,
}: {
  selectedExpenses: EnrichedExpense[];
  categories: CategoryWithChildren[];
  onCategoryChange: (categoryId: string, categoryName: string) => void;
  onPaymentMethodChange: (methodName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (selectedExpenses.length === 0) return;
    listPaymentMethodsForHousehold().then((result) => {
      if (result.data) setPaymentMethods(result.data.map((m) => ({ id: m.id, name: m.name })));
    });
  }, [selectedExpenses.length > 0]);

  if (selectedExpenses.length === 0) return null;

  const total = selectedExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  function exportSelected() {
    const header = ["Date", "Item", "Category", "Amount", "Paid By", "Payment Method", "Notes"];
    const rows = selectedExpenses.map((e) => [
      e.expense_date,
      e.merchant_name ?? e.item_name,
      e.category_name ?? "",
      e.amount,
      e.payer_name,
      e.payment_method ?? "",
      (e.notes ?? "").replace(/[\r\n,]+/g, " "),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gharkharch-selected-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedExpenses.length} expense${selectedExpenses.length === 1 ? "" : "s"}`);
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-4">
        <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="min-w-0 shrink-0 pr-1">
            <p className="text-xs font-semibold text-foreground">{selectedExpenses.length} selected</p>
            <p className="text-[10px] text-muted-foreground">{formatINR(total)}</p>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1.5 overflow-x-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none">
                <Tag className="h-3.5 w-3.5" />
                Category
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {categories.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => onCategoryChange(c.id, c.name)}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none">
                <CreditCard className="h-3.5 w-3.5" />
                Payment
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {paymentMethods.length === 0 ? (
                  <DropdownMenuItem disabled>No payment methods set up</DropdownMenuItem>
                ) : (
                  paymentMethods.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => onPaymentMethodChange(m.name)}>
                      {m.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={exportSelected}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
              aria-label="Export selected as CSV"
              title="Export selected as CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
              aria-label="Delete selected"
              title="Delete selected"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${selectedExpenses.length} expense${selectedExpenses.length === 1 ? "" : "s"}?`}
        description={`This deletes the selected expenses (${formatINR(total)} total). You can undo right after.`}
        confirmLabel="Delete selected"
        cancelLabel="Keep"
        destructive={true}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete();
        }}
      />
    </>
  );
}
