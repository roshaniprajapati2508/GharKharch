"use client";

import { useMemo, useState } from "react";
import { dayGroupLabel } from "@/lib/date-utils";
import { formatINR } from "@/lib/utils";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateExpenseNotes } from "@/lib/actions/expenses";
import { toast } from "sonner";
import type { EnrichedExpense } from "@/lib/actions/expenses";

export function ExpenseList({
  expenses,
  onEdit,
  onDuplicate,
  onDelete,
  onAdd,
}: {
  expenses: EnrichedExpense[];
  onEdit: (expense: EnrichedExpense) => void;
  onDuplicate: (expense: EnrichedExpense) => void;
  onDelete: (expense: EnrichedExpense) => void;
  onAdd?: () => void;
}) {
  const [noteTarget, setNoteTarget] = useState<EnrichedExpense | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: EnrichedExpense[] }>();
    for (const e of expenses) {
      const label = dayGroupLabel(e.expense_date);
      const group = map.get(e.expense_date) ?? { label, total: 0, items: [] };
      group.total += parseFloat(e.amount);
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
        description="Once you add an expense, GharKharch starts building your spending picture — automatically."
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
            <span className="text-xs text-muted-foreground">{formatINR(group.total)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {group.items.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                onEdit={() => onEdit(e)}
                onDuplicate={() => onDuplicate(e)}
                onDelete={() => onDelete(e)}
                onAddNote={() => {
                  setNoteTarget(e);
                  setNoteValue(e.notes ?? "");
                }}
              />
            ))}
          </div>
        </div>
      ))}

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
