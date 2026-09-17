"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/lib/context/offline-context";
import { syncPendingExpenses } from "@/lib/offline/offline-queue";
import { toast } from "sonner";
import { useState } from "react";

/** Visible, honest offline/pending-sync state (spec section 41: never pretend a queued expense is already saved). */
export function OfflineBanner() {
  const { isOnline, pendingCount, refreshPendingCount } = useOffline();
  const [syncing, setSyncing] = useState(false);

  if (isOnline && pendingCount === 0) return null;

  async function retrySync() {
    setSyncing(true);
    const { synced, failed } = await syncPendingExpenses();
    setSyncing(false);
    refreshPendingCount();
    if (synced > 0) toast.success(`${synced} expense${synced === 1 ? "" : "s"} synced`);
    if (failed > 0 && synced === 0) toast.error("Still offline — will keep trying");
  }

  return (
    <div className="no-print flex items-center gap-2 border-b border-border bg-brand-cream px-4 py-2 text-xs font-medium text-brand-charcoal">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        {!isOnline ? "You're offline." : "Back online."}
        {pendingCount > 0 && ` ${pendingCount} expense${pendingCount === 1 ? "" : "s"} waiting to sync.`}
      </span>
      {isOnline && pendingCount > 0 && (
        <button type="button" onClick={retrySync} disabled={syncing} className="flex items-center gap-1 text-brand-primary">
          <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Sync
        </button>
      )}
    </div>
  );
}
