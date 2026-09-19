"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight, History } from "lucide-react";
import { getRecentActivity, type ActivityEvent } from "@/lib/actions/activity";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { formatINR, cn } from "@/lib/utils";

/** "10 mins ago" / "2 hours ago" / "3 days ago" from an ISO timestamp, refreshed on each render (the parent re-fetches often enough that a live ticking clock isn't needed here). */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const EVENT_META: Record<ActivityEvent["type"], { verb: string; icon: typeof Plus; className: string }> = {
  added: { verb: "added", icon: Plus, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  edited: { verb: "edited", icon: Pencil, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  deleted: { verb: "deleted", icon: Trash2, className: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

/**
 * Chronological couple activity stream (spec: Pillar 6) - "Harsh added
 * Petrol · 10 mins ago". Read-only; the actual undo affordance already
 * lives on the delete toast itself (see expenses-page-client.tsx /
 * dashboard-page-client.tsx's toastUndo call) rather than being duplicated
 * here.
 */
export function ActivityFeedCard() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  async function load() {
    const result = await getRecentActivity(10);
    setEvents(result.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  // Refresh whenever the global Add Expense sheet saves, so a just-added
  // expense shows up here without a manual reload (same pattern every other
  // dashboard card uses via useOnExpenseSaved).
  useOnExpenseSaved(load);

  if (events !== null && events.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Recent Activity
        </p>
        <Link href="/more/activity" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
          View full log <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {events === null ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {events.map((e) => {
            const meta = EVENT_META[e.type];
            const Icon = meta.icon;
            return (
              <li key={`${e.id}-${e.type}`} className="flex items-start gap-2.5 text-xs">
                <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", meta.className)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">
                    <strong className="font-semibold">{e.personName}</strong> {meta.verb}{" "}
                    <span className="text-muted-foreground">{e.itemName}</span>
                    {e.type !== "deleted" ? <> &middot; {formatINR(e.amount)}</> : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
