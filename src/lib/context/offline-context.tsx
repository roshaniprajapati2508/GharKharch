"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getPendingExpenses, syncPendingExpenses } from "@/lib/offline/offline-queue";

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  refreshPendingCount: () => void;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}

/**
 * Tracks connectivity and the offline expense queue (spec section 41) for the
 * whole app: refreshes the pending count on mount, and syncs automatically
 * the moment the browser reports it's back online.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const syncing = useRef(false);

  const refreshPendingCount = useCallback(() => {
    getPendingExpenses().then((items) => setPendingCount(items.length));
  }, []);

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    const { synced } = await syncPendingExpenses();
    syncing.current = false;
    refreshPendingCount();
    if (synced > 0) {
      toast.success(`${synced} queued expense${synced === 1 ? "" : "s"} synced`);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's actual connectivity state on mount
    setIsOnline(navigator.onLine);
    refreshPendingCount();
    if (navigator.onLine) runSync();

    function handleOnline() {
      setIsOnline(true);
      runSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <OfflineContext.Provider value={{ isOnline, pendingCount, refreshPendingCount }}>{children}</OfflineContext.Provider>;
}
