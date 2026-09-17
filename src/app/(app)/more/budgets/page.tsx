"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronLeft as ChevronLeftSm, Plus, Pencil, Trash2, Wallet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/lib/icon-map";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { listBudgetsForMonth, upsertBudget, deleteBudget, toPeriodMonth, type BudgetWithProgress } from "@/lib/actions/budgets";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { formatINR } from "@/lib/utils";
import type { Tables } from "@/types/database";

const ROW_MOTION = {
  layout: true as const,
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

function monthLabel(periodMonth: string) {
  const [y, m] = periodMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shiftMonth(periodMonth: string, delta: number) {
  const [y, m] = periodMonth.split("-").map(Number);
  return toPeriodMonth(new Date(y, m - 1 + delta, 1));
}

function progressColor(pct: number) {
  if (pct >= 100) return "bg-destructive";
  if (pct >= 80) return "bg-warning";
  return "bg-brand-primary";
}

type FormState = { id: string | null; categoryId: string | null; amount: string };
const EMPTY_FORM: FormState = { id: null, categoryId: null, amount: "" };

export default function BudgetsPage() {
  const [periodMonth, setPeriodMonth] = useState(() => toPeriodMonth(new Date()));
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BudgetWithProgress | null>(null);

  async function load(month: string) {
    setLoading(true);
    const [budgetsResult, categoriesResult] = await Promise.all([listBudgetsForMonth(month), listCategoriesForHousehold()]);
    if (budgetsResult.data) setBudgets(budgetsResult.data);
    if (categoriesResult.data) setCategories(categoriesResult.data.flat.filter((c) => !c.parent_id));
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch whenever the selected month changes
    load(periodMonth);
  }, [periodMonth]);

  const usedCategoryIds = useMemo(() => new Set(budgets.filter((b) => b.category_id).map((b) => b.category_id)), [budgets]);
  const hasOverall = budgets.some((b) => b.category_id === null);
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id) || c.id === form?.categoryId);

  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.filter((b) => b.category_id !== null).reduce((sum, b) => sum + b.spent, 0);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(b: BudgetWithProgress) {
    setForm({ id: b.id, categoryId: b.category_id, amount: String(b.amount) });
  }

  async function handleSave() {
    if (!form) return;
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSaving(true);
    const result = await upsertBudget({ category_id: form.categoryId, amount, period_month: periodMonth });
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(form.id ? "Budget updated" : "Budget added");
    setForm(null);
    load(periodMonth);
  }

  async function handleDelete() {
    if (!removeTarget) return;
    const result = await deleteBudget(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget removed");
    setRemoveTarget(null);
    load(periodMonth);
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Budgets</h1>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border px-2 py-1.5">
        <button
          onClick={() => setPeriodMonth((p) => shiftMonth(p, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeftSm className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel(periodMonth)}</span>
        <button
          onClick={() => setPeriodMonth((p) => shiftMonth(p, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!loading && budgets.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-foreground">Total budgeted</p>
            <p className="text-lg font-bold text-foreground">{formatINR(totalBudgeted)}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatINR(totalSpent)} spent so far against category budgets this month
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No budgets set for {monthLabel(periodMonth)}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Set a monthly cap for a category, or an overall household limit, and track spending against it as the month goes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {budgets.map((b) => {
              const amount = Number(b.amount);
              const pct = amount > 0 ? (b.spent / amount) * 100 : 0;
              const overBudget = b.spent > amount;
              return (
                <motion.div key={b.id} {...ROW_MOTION} className="overflow-hidden rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    {b.category_id ? (
                      <CategoryIcon icon={b.category_icon} color={b.category_color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Wallet className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{b.category_name}</p>
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          {formatINR(b.spent)} <span className="font-normal text-muted-foreground">/ {formatINR(amount)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="ml-1 flex shrink-0 items-center gap-0.5">
                      <button onClick={() => openEdit(b)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" aria-label="Edit budget">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setRemoveTarget(b)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete budget">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${progressColor(pct)}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% used</p>
                    {overBudget && (
                      <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {formatINR(b.spent - amount)} over
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {!loading && (availableCategories.length > 0 || !hasOverall) && (
        <Button variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Set a budget
        </Button>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setForm(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">{form.id ? "Edit budget" : "Set a budget"}</h2>

            {!form.id && (
              <div className="mb-4">
                <Label className="text-xs">For</Label>
                <select
                  value={form.categoryId ?? ""}
                  onChange={(e) => setForm((f) => (f ? { ...f, categoryId: e.target.value || null } : f))}
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
                >
                  {!hasOverall && <option value="">Overall household</option>}
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Label className="text-xs">Monthly amount</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => (f ? { ...f, amount: e.target.value } : f))}
              placeholder="e.g. 8000"
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={saving} disabled={!form.amount.trim()} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove this budget?`}
        description={`"${removeTarget?.category_name}" won't be tracked against a limit anymore this month. Past months are unaffected.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
