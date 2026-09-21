"use client";

import { useMemo, useState } from "react";
import { dayGroupLabel } from "@/lib/date-utils";
import { formatINR } from "@/lib/utils";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { AnalyzeExpenseSheet } from "@/components/expenses/analyze-expense-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateExpenseNotes, getReceiptSignedUrl } from "@/lib/actions/expenses";
import { toast } from "sonner";
import type { EnrichedExpense, InlineEditableField } from "@/lib/actions/expenses";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { Tables } from "@/types/database";

export function ExpenseList({
  expenses,
  onEdit,
  onDuplicate,
  onDelete,
  onAdd,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onInlineUpdate,
  categories,
  paymentMethods,
  onPaidByChange,
}: {
  expenses: EnrichedExpense[];
  onEdit: (expense: EnrichedExpense) => void;
  onDuplicate: (expense: EnrichedExpense) => void;
  onDelete: (expense: EnrichedExpense) => void;
  onAdd?: () => void;
  /** Multi-select + inline edit (spec: Pillar 4). All four are optional and default to off, so existing callers (e.g. the dashboard's compact "recent" list) are unaffected. */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (expense: EnrichedExpense) => void;
  onInlineUpdate?: (expense: EnrichedExpense, field: InlineEditableField, value: string) => Promise<boolean>;
  /** Desktop hover micro-action toolbar (spec: Feature 3.3) - category/payment quick-switch options. Omit to hide the toolbar entirely (e.g. the dashboard's compact list). */
  categories?: CategoryWithChildren[];
  paymentMethods?: Tables<"payment_methods">[];
  onPaidByChange?: (expense: EnrichedExpense, userId: string, label: string) => void;
}) {
  const [noteTarget, setNoteTarget] = useState<EnrichedExpense | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [analyzeTarget, setAnalyzeTarget] = useState<EnrichedExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedExpense | null>(null);

  async function viewReceipt(expense: EnrichedExpense) {
    if (!expense.receipt_path) return;
    const result = await getReceiptSignedUrl(expense.receipt_path);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  }

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; expenseTotal: number; incomeTotal: number; items: EnrichedExpense[] }>();
    for (const e of expenses) {
      const label = dayGroupLabel(e.expense_date);
      const group = map.get(e.expense_date) ?? { label, expenseTotal: 0, incomeTotal: 0, items: [] };
      const amt = parseFloat(e.amount) || 0;
      if (e.entry_type === "income") {
        group.incomeTotal += amt;
      } else {
        group.expenseTotal += amt;
      }
      group.items.push(e);
      map.set(e.expense_date, group);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, group]) => ({ date, ...group }));
  }, [expenses]);

  async function saveNote() {
    if (!noteTarget) return;
    setSavingNote(true);
    const result = await updateExpenseNotes(noteTarget.id, noteValue);
    setSavingNote(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Note saved");
    setNoteTarget(null);
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="Your household spending story starts here."
        description="Once you add an expense, GharKharch starts building your spending picture - automatically."
        ctaLabel={onAdd ? "Add your first expense" : undefined}
        onCta={onAdd}
        chips={["Milk", "Groceries", "Petrol", "Shopping"]}
        variant="expenses"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
              {group.incomeTotal > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">+{formatINR(group.incomeTotal)}</span>
              )}
              {group.expenseTotal > 0 && (
                <span className="text-rose-600 dark:text-rose-400">-{formatINR(group.expenseTotal)}</span>
              )}
              {group.incomeTotal === 0 && group.expenseTotal === 0 && (
                <span className="text-muted-foreground">{formatINR(0)}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {group.items.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                onEdit={() => onEdit(e)}
                onDuplicate={() => onDuplicate(e)}
                onDelete={() => setDeleteTarget(e)}
                onAddNote={() => {
                  setNoteTarget(e);
                  setNoteValue(e.notes ?? "");
                }}
                onAnalyze={() => setAnalyzeTarget(e)}
                onViewReceipt={() => viewReceipt(e)}
                selectionMode={selectionMode}
                selected={selectedIds?.has(e.id) ?? false}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(e) : undefined}
                onInlineUpdate={onInlineUpdate ? (field, value) => onInlineUpdate(e, field, value) : undefined}
                categories={categories}
                paymentMethods={paymentMethods}
                onPaidByChange={onPaidByChange ? (userId, label) => onPaidByChange(e, userId, label) : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      <AnalyzeExpenseSheet open={!!analyzeTarget} onOpenChange={(open) => !open && setAnalyzeTarget(null)} expense={analyzeTarget} />

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete expense?"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.merchant_name || deleteTarget.item_name}" for ${formatINR(deleteTarget.amount)}?`
            : "Are you sure you want to delete this expense?"
        }
        confirmLabel="Delete expense"
        cancelLabel="Keep"
        destructive={true}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />

      <Dialog open={!!noteTarget} onOpenChange={(open) => !open && setNoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteTarget?.notes ? "Edit note" : "Add note"}</DialogTitle>
          </DialogHeader>
          <Textarea value={noteValue} onChange={(e) => setNoteValue(e.target.value)} rows={3} maxLength={500} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={savingNote}>
              {savingNote ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
