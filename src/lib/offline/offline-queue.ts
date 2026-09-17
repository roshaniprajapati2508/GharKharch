"use client";

// Offline expense queue (spec section 41, 42): when a save can't reach the
// server, the expense is written to IndexedDB and marked "pending sync"
// rather than silently discarded or falsely reported as saved. A network
// listener (wired up by OfflineSyncProvider) retries queued items as soon as
// connectivity returns. Per spec: "Do NOT compromise data integrity for a
// fake offline experience" — a queued expense stays visibly pending until the
// server has actually accepted it.

import { idbGetAll, idbPut, idbDelete, STORE_PENDING_EXPENSES } from "@/lib/offline/db";
import { createExpense } from "@/lib/actions/expenses";
import type { ExpenseFormInput } from "@/lib/validations/expense";

export interface PendingExpense {
  localId: string;
  payload: ExpenseFormInput;
  queuedAt: string;
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** True for a genuine connectivity failure — never true for a validation/server error, which must surface to the user instead of being silently queued. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network/i.test(err.message);
}

export async function queueExpense(payload: ExpenseFormInput): Promise<PendingExpense> {
  const pending: PendingExpense = {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queuedAt: new Date().toISOString(),
  };
  await idbPut(STORE_PENDING_EXPENSES, pending);
  return pending;
}

export async function getPendingExpenses(): Promise<PendingExpense[]> {
  try {
    return await idbGetAll<PendingExpense>(STORE_PENDING_EXPENSES);
  } catch {
    return [];
  }
}

export interface SyncResult {
  synced: number;
  failed: number;
}

/** Attempts to save every queued expense for real. A queued item is only ever removed once the server has confirmed it — a failed attempt is left in the queue for the next sync. */
export async function syncPendingExpenses(): Promise<SyncResult> {
  const pending = await getPendingExpenses();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const result = await createExpense(item.payload);
      if (result.error === null) {
        await idbDelete(STORE_PENDING_EXPENSES, item.localId);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break; // still offline (or the server is unreachable) — stop and retry later rather than failing every remaining item one by one
    }
  }

  return { synced, failed };
}
