"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Plus, Pencil, Trash2, Repeat, PauseCircle, PlayCircle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/lib/icon-map";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { PaidBySelector, ExpenseTypeSelector } from "@/components/expenses/person-selector";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO } from "@/lib/date-utils";
import {
  listRecurringExpenses,
  getRecurringSummary,
  createRecurringExpense,
  updateRecurringExpense,
  setRecurringActive,
  deleteRecurringExpense,
  logRecurringOccurrence,
  type RecurringWithCategory,
  type RecurringSummary,
} from "@/lib/actions/recurring";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { formatINR } from "@/lib/utils";
import type { RecurringFrequency, ExpenseType } from "@/types/database";

const ROW_MOTION = {
  layout: true as const,
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

type FormState = {
  id: string | null;
  name: string;
  amount: string;
  categoryId: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
};

function emptyForm(): FormState {
  return { id: null, name: "", amount: "", categoryId: "", frequency: "monthly", nextDueDate: "" };
}

type LogFormState = { amount: string; paidBy: string; expenseType: ExpenseType; date: string };

export default function RecurringExpensesPage() {
  const { userId } = useHousehold();
  const [rules, setRules] = useState<RecurringWithCategory[]>([]);
  const [summary, setSummary] = useState<RecurringSummary | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RecurringWithCategory | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<RecurringWithCategory | null>(null);
  const [logForm, setLogForm] = useState<LogFormState | null>(null);
  const [logging, setLogging] = useState(false);

  async function load() {
    setLoading(true);
    const [rulesResult, summaryResult, categoriesResult] = await Promise.all([
      listRecurringExpenses(),
      getRecurringSummary(),
      listCategoriesForHousehold(),
    ]);
    if (rulesResult.data) setRules(rulesResult.data);
    if (summaryResult.data) setSummary(summaryResult.data);
    if (categoriesResult.data) setCategoryTree(categoriesResult.data.tree);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm());
  }

  function openEdit(r: RecurringWithCategory) {
    setForm({
      id: r.id,
      name: r.name,
      amount: String(r.amount),
      categoryId: r.category_id,
      frequency: r.frequency,
      nextDueDate: r.next_due_date ?? "",
    });
  }

  async function handleSave() {
    if (!form) return;
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) {
      toast.error("Enter a name");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (!form.categoryId) {
      toast.error("Choose a category");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      amount,
      category_id: form.categoryId,
      merchant_id: null,
      frequency: form.frequency,
      next_due_date: form.nextDueDate || null,
    };
    const result = form.id ? await updateRecurringExpense(form.id, payload) : await createRecurringExpense(payload);
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(form.id ? "Recurring expense updated" : "Recurring expense added");
    setForm(null);
    load();
  }

  async function handleToggleActive(r: RecurringWithCategory) {
    setTogglingId(r.id);
    const result = await setRecurringActive(r.id, !r.active);
    setTogglingId(null);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(r.active ? `${r.name} paused` : `${r.name} resumed`);
    load();
  }

  // "Log this bill" (spec: never a one-tap silent log — the person must be
  // able to review/adjust the amount, since real bill amounts drift). A
  // small inline confirm rather than reusing AddExpenseSheet's
  // duplicateFrom: that prop expects an EnrichedExpense (a full past
  // expense row with id/created_at/etc.), which a recurring RULE isn't —
  // building a fake one would be more surface area than this focused form,
  // which only needs the handful of fields logRecurringOccurrence actually
  // takes.
  function openLog(r: RecurringWithCategory) {
    setLogTarget(r);
    setLogForm({ amount: String(r.amount), paidBy: userId, expenseType: "household", date: r.next_due_date ?? getTodayISO() });
  }

  async function handleLogSubmit() {
    if (!logTarget || !logForm) return;
    const amount = parseFloat(logForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setLogging(true);
    const result = await logRecurringOccurrence(logTarget.id, {
      amount,
      paid_by: logForm.paidBy,
      expense_type: logForm.expenseType,
      expense_date: logForm.date,
    });
    setLogging(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`${logTarget.name} logged · ${formatINR(amount)}`);
    setLogTarget(null);
    setLogForm(null);
    load();
  }

  async function handleDelete() {
    if (!removeTarget) return;
    const result = await deleteRecurringExpense(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Recurring expense removed");
    setRemoveTarget(null);
    load();
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Recurring expenses</h1>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Track rent, subscriptions, EMIs and other bills that repeat. GharKharch will never log an expense on its own from these — they&apos;re just bookkeeping for what to expect.
      </p>

      {!loading && summary && summary.upcoming.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-foreground">Total monthly recurring</p>
            <p className="text-lg font-bold text-foreground">{formatINR(summary.monthlyTotal)}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Every active rule, normalized to a monthly amount</p>
        </div>
      )}

      {!loading && summary && summary.upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Upcoming</p>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {summary.upcoming.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <CategoryIcon icon={r.category_icon} color={r.category_color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.next_due_date
                      ? `Due ${new Date(r.next_due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : "No due date set"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">{formatINR(r.amount)}</p>
                <button
                  type="button"
                  onClick={() => openLog(r)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Log
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Repeat className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nothing set up yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">Add rent, a subscription, or an EMI so the household knows what&apos;s coming.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          <AnimatePresence initial={false}>
            {rules.map((r) => (
              <motion.div key={r.id} {...ROW_MOTION} className={`flex items-center gap-3 overflow-hidden px-3 py-2.5 ${!r.active ? "opacity-50" : ""}`}>
                <CategoryIcon icon={r.category_icon} color={r.category_color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                    {!r.active && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatINR(r.amount)} · {FREQUENCIES.find((f) => f.value === r.frequency)?.label ?? r.frequency}
                    {r.next_due_date ? ` · next ${new Date(r.next_due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => handleToggleActive(r)}
                    disabled={togglingId === r.id}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                    title={r.active ? "Pause" : "Resume"}
                  >
                    {r.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(r)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setRemoveTarget(r)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!loading && (
        <Button variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add recurring expense
        </Button>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setForm(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">{form.id ? "Edit recurring expense" : "Add recurring expense"}</h2>

            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))} placeholder="e.g. Rent, Netflix, Car EMI" className="mt-1.5" autoFocus />
              </div>

              <div>
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => (f ? { ...f, amount: e.target.value } : f))}
                  placeholder="e.g. 15000"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => (f ? { ...f, categoryId: e.target.value } : f))}
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
                >
                  <option value="">Choose a category</option>
                  {categoryTree.map((top) => (
                    <Fragment key={top.id}>
                      <option value={top.id}>{top.name}</option>
                      {top.children.map((child) => (
                        <option key={child.id} value={child.id}>
                          {"— " + child.name}
                        </option>
                      ))}
                    </Fragment>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Frequency</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setForm((prev) => (prev ? { ...prev, frequency: f.value } : prev))}
                      className={`h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                        form.frequency === f.value ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Next due date (optional)</Label>
                <Input
                  type="date"
                  value={form.nextDueDate}
                  onChange={(e) => setForm((f) => (f ? { ...f, nextDueDate: e.target.value } : f))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {logTarget && logForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setLogTarget(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold text-foreground">Log this bill</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Adds a real expense for {logTarget.name} and moves its next due date forward. Review the amount before saving — prices change.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  value={logForm.amount}
                  onChange={(e) => setLogForm((f) => (f ? { ...f, amount: e.target.value } : f))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={logForm.date}
                  onChange={(e) => setLogForm((f) => (f ? { ...f, date: e.target.value } : f))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs">Paid by</Label>
                <div className="mt-1.5">
                  <PaidBySelector value={logForm.paidBy} onChange={(v) => setLogForm((f) => (f ? { ...f, paidBy: v } : f))} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Expense type</Label>
                <div className="mt-1.5">
                  <ExpenseTypeSelector value={logForm.expenseType} onChange={(v) => setLogForm((f) => (f ? { ...f, expenseType: v } : f))} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLogTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={logging} onClick={handleLogSubmit}>
                Log this bill
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.name}"?`}
        description="Past expenses already logged from this rule keep their amount and category — they just won't be tagged as recurring anymore."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
