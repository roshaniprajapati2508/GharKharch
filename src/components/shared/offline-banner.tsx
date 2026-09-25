"use client";

import { useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/lib/context/offline-context";
import { syncPendingExpenses } from "@/lib/offline/offline-queue";
import { toastSuccess, toastError } from "@/lib/toast-helpers";
import { OperationLoader } from "@/components/shared/operation-loader";

/** Visible, honest offline/pending-sync state with OperationLoader feedback. */
export function OfflineBanner() {
  const { isOnline, pendingCount, refreshPendingCount } = useOffline();
  const [syncing, setSyncing] = useState(false);

  if (isOnline && pendingCount === 0) return null;

  async function retrySync() {
    setSyncing(true);
    try {
      const { synced, failed } = await syncPendingExpenses();
      refreshPendingCount();
      if (synced > 0) {
        toastSuccess(`✨ ${synced} expense${synced === 1 ? "" : "s"} synced successfully`);
      }
      if (failed > 0 && synced === 0) {
        toastError("Still offline — will retry automatically once connection returns");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <OperationLoader
        open={syncing}
        title="Syncing offline records..."
        subtitle="Please keep this tab open while queued expenses sync"
      />

      <div className="no-print flex items-center gap-2 border-b border-border bg-brand-cream px-4 py-2 text-xs font-medium text-brand-charcoal">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          {!isOnline ? "You're offline." : "Back online."}
          {pendingCount > 0 && ` ${pendingCount} expense${pendingCount === 1 ? "" : "s"} waiting to sync.`}
        </span>
        {isOnline && pendingCount > 0 && (
          <button
            type="button"
            onClick={retrySync}
            disabled={syncing}
            className="flex items-center gap-1 font-semibold text-brand-primary hover:underline cursor-pointer"
          >
            <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Sync now
          </button>
        )}
      </div>
    </>
  );
}
