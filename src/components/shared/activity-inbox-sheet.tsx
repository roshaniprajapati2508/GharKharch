"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Zap, Receipt, PiggyBank, CheckCheck } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActivityEvents, markActivityEventRead, markAllActivityRead, type ActivityEventView } from "@/lib/actions/activity-events";

type FilterKey = "all" | "partner" | "alerts";

/** "10 mins ago" / "2 hours ago" / "3 days ago" - same convention as ActivityFeedCard's timeAgo on the dashboard. */
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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "partner", label: "By Partner" },
  { key: "alerts", label: "Alerts" },
];

function eventIcon(eventType: string) {
  if (eventType === "rule_triggered") return Zap;
  if (eventType === "budget_alert") return PiggyBank;
  return Receipt;
}

/** Entity deep-link (spec: Module 3) - an expense/merchant/rule event links back to where it happened. */
function entityHref(event: ActivityEventView): string | null {
  if (event.entity_type === "merchant" && event.entity_id) return `/more/merchants/${event.entity_id}`;
  if (event.entity_type === "rule") return "/more/rules";
  // Expenses don't have their own detail route - the Expenses list (with search) is the closest deep link.
  if (event.entity_type === "expense") return "/expenses";
  return null;
}

/**
 * Unified Household Activity & Audit Inbox (spec: Module 3) - a bottom
 * sheet (this app's one drawer convention, used for every other sheet -
 * Add Expense, Merchant detail edit, etc. - rather than introducing a
 * separate right-edge slide-over primitive) listing every logged
 * activity_events row (migration 025): expense saves/edits/deletes, Smart
 * Rule auto-fills, and budget alerts, each showing who did it and when,
 * with per-user read state and a "Mark all as read" action.
 */
export function ActivityInboxSheet({ open, onOpenChange, onReadStateChange }: { open: boolean; onOpenChange: (open: boolean) => void; onReadStateChange?: () => void }) {
  const [events, setEvents] = useState<ActivityEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [markingAll, setMarkingAll] = useState(false);

  async function load(f: FilterKey) {
    setLoading(true);
    const result = await getActivityEvents({ filter: f === "all" ? "all" : f });
    if (result.data) setEvents(result.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filter]);

  const unreadCount = useMemo(() => events.filter((e) => !e.isRead).length, [events]);

  async function handleOpenEvent(event: ActivityEventView) {
    if (!event.isRead) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isRead: true } : e)));
      await markActivityEventRead(event.id);
      onReadStateChange?.();
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const result = await markAllActivityRead();
    setMarkingAll(false);
    if (result.error === null) {
      setEvents((prev) => prev.map((e) => ({ ...e, isRead: true })));
      onReadStateChange?.();
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader>
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <Bell className="h-4.5 w-4.5" /> Activity
              </DrawerTitle>
              <DrawerDescription>Everything that happened in your household, in one place.</DrawerDescription>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={markingAll} className="shrink-0 gap-1 text-xs">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </div>
        </DrawerHeader>

        <div className="flex gap-1.5 px-4 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors",
                filter === f.key ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-6">
          {loading && (
            <>
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            </>
          )}

          {!loading && events.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          )}

          {!loading &&
            events.map((event) => {
              const Icon = eventIcon(event.event_type);
              const href = entityHref(event);
              const body = (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                    event.isRead ? "border-border/40 bg-card/60" : "border-primary/30 bg-secondary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      event.is_alert ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{event.summary}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {event.actorName ?? "System"} · {timeAgo(event.created_at)}
                    </p>
                  </div>
                  {!event.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
              );
              return (
                <div key={event.id} onClick={() => handleOpenEvent(event)}>
                  {href ? (
                    <Link href={href} prefetch={false} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              );
            })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
