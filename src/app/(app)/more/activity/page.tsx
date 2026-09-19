"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  History,
  CheckCheck,
  Search,
  Bell,
  Zap,
  Receipt,
  PiggyBank,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getActivityEvents,
  markActivityEventRead,
  markAllActivityRead,
  type ActivityEventView,
} from "@/lib/actions/activity-events";

type FilterKey = "all" | "expenses" | "rules" | "alerts" | "partner";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Activity" },
  { key: "expenses", label: "Expenses" },
  { key: "rules", label: "Smart Rules" },
  { key: "alerts", label: "Alerts" },
  { key: "partner", label: "By Partner" },
];

function eventIcon(eventType: string) {
  if (eventType === "rule_triggered") return Zap;
  if (eventType === "budget_alert") return PiggyBank;
  if (eventType.includes("expense") || eventType.includes("scratchpad")) return Receipt;
  return History;
}

function eventBadge(eventType: string) {
  if (eventType === "rule_triggered") {
    return { label: "Smart Rule", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" };
  }
  if (eventType === "budget_alert") {
    return { label: "Budget Alert", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
  }
  if (eventType === "expense_deleted") {
    return { label: "Deleted", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
  }
  if (eventType === "expense_updated") {
    return { label: "Edited", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  return { label: "Logged", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
}

function entityHref(event: ActivityEventView): string | null {
  if (event.entity_type === "merchant" && event.entity_id) return `/more/merchants/${event.entity_id}`;
  if (event.entity_type === "rule") return "/more/rules";
  if (event.entity_type === "expense") return "/expenses";
  return null;
}

function formatEventDateGroup(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Dedicated Household Activity & Audit Trail Page (`/more/activity`)
 * Displays comprehensive historical timeline of all actions taken in the household
 * with date grouping, full details, search filtering, and deep links.
 */
export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  async function load(f: FilterKey) {
    setLoading(true);
    const result = await getActivityEvents({ filter: f, limit: 150 });
    if (result.data) setEvents(result.data);
    setLoading(false);
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return events;
    return events.filter((e) => {
      const summaryMatch = e.summary?.toLowerCase().includes(q);
      const actorMatch = e.actorName?.toLowerCase().includes(q);
      const typeMatch = e.event_type?.toLowerCase().includes(q);
      return summaryMatch || actorMatch || typeMatch;
    });
  }, [events, searchQuery]);

  // Group events by day
  const groupedEvents = useMemo(() => {
    const groups: { dateLabel: string; items: ActivityEventView[] }[] = [];
    for (const event of filteredEvents) {
      const label = formatEventDateGroup(event.created_at);
      let group = groups.find((g) => g.dateLabel === label);
      if (!group) {
        group = { dateLabel: label, items: [] };
        groups.push(group);
      }
      group.items.push(event);
    }
    return groups;
  }, [filteredEvents]);

  const unreadCount = useMemo(() => events.filter((e) => !e.isRead).length, [events]);

  async function handleMarkEventRead(event: ActivityEventView) {
    if (!event.isRead) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isRead: true } : e)));
      await markActivityEventRead(event.id);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const result = await markAllActivityRead();
    setMarkingAll(false);
    if (result.error === null) {
      setEvents((prev) => prev.map((e) => ({ ...e, isRead: true })));
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/more" prefetch={true} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
          <History className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Recent Activity</h1>
          <p className="text-xs text-muted-foreground">Household audit trail and timeline</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="ml-auto gap-1 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keyword, person, or action..."
            className="h-10 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : groupedEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">No activity found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery ? "Try refining your search keyword." : "All household activity will appear here in chronological order."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEvents.map((group) => (
            <div key={group.dateLabel} className="space-y-2.5">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.dateLabel}
              </h2>
              <div className="space-y-2">
                {group.items.map((event) => {
                  const Icon = eventIcon(event.event_type);
                  const badge = eventBadge(event.event_type);
                  const href = entityHref(event);

                  return (
                    <div
                      key={event.id}
                      onClick={() => handleMarkEventRead(event)}
                      className={cn(
                        "group relative flex items-start gap-3.5 rounded-2xl border p-4 transition-all",
                        event.isRead
                          ? "border-border/60 bg-card/90 shadow-xs backdrop-blur-md"
                          : "border-primary/40 bg-secondary/20 shadow-xs"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          event.is_alert
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-brand-mint text-brand-primary"
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {event.actorName ? `by ${event.actorName}` : "System"} &middot; {formatEventTime(event.created_at)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-semibold text-foreground">{event.summary}</p>

                        {href && (
                          <div className="mt-2">
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
                            >
                              <span>View details</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </div>

                      {!event.isRead && (
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                          title="Unread event"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
