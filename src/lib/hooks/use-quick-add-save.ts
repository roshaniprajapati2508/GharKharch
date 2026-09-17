"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useHousehold } from "@/lib/context/household-context";
import { useOffline } from "@/lib/context/offline-context";
import { isOffline, isNetworkError, queueExpense } from "@/lib/offline/offline-queue";
import { createExpense } from "@/lib/actions/expenses";
import { getTodayISO } from "@/lib/date-utils";
import type { QuickAddChip } from "@/lib/actions/quick-add";
import type { Tables } from "@/types/database";

interface UseQuickAddSaveOptions {
  /** Fired once a chip's expense has actually been accepted by the server. */
  onSaved?: (expense: Tables<"expenses">) => void;
  /** Fired when the tap was queued instead (offline, or a network error mid-save). */
  onQueued?: (chip: QuickAddChip) => void;
}

/**
 * Shared "tap a Quick Add chip, save instantly" logic (spec sections 10, 22,
 * 81): builds the same expense payload a chip has always produced, saves it
 * via the real `createExpense` action, and falls back to the offline queue
 * on a connectivity failure — exactly what the Add Expense sheet's
 * `QuickAddBar` has always done. Both the sheet and the dashboard's Daily
 * Brief card call this instead of each re-implementing the save/queue/retry
 * flow themselves.
 */
export function useQuickAddSave({ onSaved, onQueued }: UseQuickAddSaveOptions = {}) {
  const { userId } = useHousehold();
  const { refreshPendingCount } = useOffline();
  const [savingChip, setSavingChip] = useState<QuickAddChip | null>(null);

  async function saveChip(chip: QuickAddChip) {
    const payload = {
      amount: chip.amount || 0,
      item_name: chip.itemName,
      category_id: chip.categoryId,
      subcategory_id: chip.subcategoryId,
      merchant_id: chip.merchantId,
      paid_by: userId,
      expense_type: "household" as const,
      expense_date: getTodayISO(),
    };

    if (isOffline()) {
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${chip.itemName} queued — will sync when back online`);
      onQueued?.(chip);
      return;
    }

    setSavingChip(chip);
    try {
      const result = await createExpense(payload);
      setSavingChip(null);
      if (result.error !== null) {
        toast.error(result.error, { action: { label: "Retry", onClick: () => saveChip(chip) } });
        return;
      }
      onSaved?.(result.data);
      toast.success(`${chip.itemName} added · ₹${chip.amount}`);
    } catch (err) {
      setSavingChip(null);
      if (isNetworkError(err)) {
        await queueExpense(payload);
        refreshPendingCount();
        toast.message(`${chip.itemName} queued — will sync when back online`);
        onQueued?.(chip);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: () => saveChip(chip) } });
      }
    }
  }

  return { saveChip, savingChip };
}
