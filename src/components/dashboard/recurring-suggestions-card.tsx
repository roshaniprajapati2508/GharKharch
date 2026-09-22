"use client";

import { useCallback, useEffect, useState } from "react";
import { Repeat, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getRecurringCandidates, createRecurringExpenseFromCandidate } from "@/lib/actions/intelligence";
import type { RecurringCandidate } from "@/lib/expense-intelligence/recurring-detector";
import type { RecurringFrequency } from "@/types/database";

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const DISMISSED_KEY = "gharkharch:dismissed-recurring-suggestions";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(names: Set<string>) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(names)));
  } catch {
    // best-effort only
  }
}

/**
 * Surfaces recurring-pattern detections (spec section 11) as a dismiss-able
 * suggestion - confirming always requires an explicit tap; nothing here ever
 * creates a recurring expense on its own (spec section 88).
 */
export function RecurringSuggestionsCard() {
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<RecurringCandidate | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>("daily");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await getRecurringCandidates();
    if (result.error === null) setCandidates(result.data);
  }, []);

  useEffect(() => {
     
    setDismissed(loadDismissed());
    load();
  }, [load]);

  function dismiss(itemName: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(itemName.toLowerCase());
      saveDismissed(next);
      return next;
    });
  }

  function openConfirm(candidate: RecurringCandidate) {
    setFrequency(candidate.suggestedFrequency);
    setConfirmTarget(candidate);
  }

  async function confirmSetup() {
    if (!confirmTarget) return;
    setSaving(true);
    const result = await createRecurringExpenseFromCandidate({
      itemName: confirmTarget.itemName,
      amount: confirmTarget.amount,
      categoryId: confirmTarget.categoryId ?? "",
      merchantId: confirmTarget.merchantId,
      frequency,
    });
    setSaving(false);
    if (result.error !== null || !confirmTarget.categoryId) {
      toast.error(result.error ?? "Couldn't determine a category for this item");
      return;
    }
    toast.success(`${confirmTarget.itemName} set up as a recurring expense`);
    dismiss(confirmTarget.itemName);
    setConfirmTarget(null);
  }

  const visible = candidates.filter((c) => !dismissed.has(c.itemName.toLowerCase()));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Har Baar Hone Wale Kharche (Recurring)</h3>
      <div className="mt-3 flex flex-col gap-2">
        {visible.slice(0, 3).map((c) => (
          <div key={c.itemName} className="flex items-center gap-3 rounded-lg bg-brand-mint p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary">
              <Repeat className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium capitalize text-foreground">{c.itemName}</p>
              <p className="text-xs text-muted-foreground">
                Usually added {c.cadenceLabel} · avg {formatINR(c.amount)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openConfirm(c)}
              className="shrink-0 rounded-full border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary"
            >
              Set recurring
            </button>
            <button
              type="button"
              onClick={() => dismiss(c.itemName)}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/60"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up recurring expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmTarget?.itemName} - usually {confirmTarget?.cadenceLabel}, average {confirmTarget && formatINR(confirmTarget.amount)}.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  frequency === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmSetup} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
