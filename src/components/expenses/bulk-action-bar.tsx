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
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-3 sm:pb-4 sm:bottom-0">
        <div className="flex w-full max-w-xl items-center justify-between gap-1.5 rounded-2xl border border-border bg-card/98 px-2.5 py-2 shadow-2xl backdrop-blur-md ring-1 ring-black/5 dark:ring-white/10 sm:gap-2 sm:px-3 sm:py-2.5">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="min-w-0 shrink-0 pr-0.5">
              <p className="text-xs font-bold leading-tight text-foreground">{selectedExpenses.length} selected</p>
              <p className="text-[10px] font-semibold leading-tight text-muted-foreground">{formatINR(total)}</p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-10 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none shrink-0 sm:gap-1.5 sm:px-3">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Category</span>
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
              <DropdownMenuTrigger className="flex h-10 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none shrink-0 sm:gap-1.5 sm:px-3">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Payment</span>
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground hover:bg-muted"
              aria-label="Export selected as CSV"
              title="Export selected as CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-surface text-destructive hover:bg-destructive/10"
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
