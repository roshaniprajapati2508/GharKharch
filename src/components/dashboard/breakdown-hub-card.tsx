"use client";

import { useState } from "react";
import Link from "next/link";
import { PieChart, Store, Users, Repeat, ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { formatINR, cn } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];
type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];

interface BreakdownHubCardProps {
  categories: CategoryBreakdownRow[];
  merchants: MerchantBreakdownRow[];
  personBreakdown: PersonBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
  grandTotal: number;
}

export function BreakdownHubCard({
  categories,
  merchants,
  personBreakdown,
  itemAnalytics,
  grandTotal,
}: BreakdownHubCardProps) {
  const { userId, partner } = useHousehold();
  const [activeTab, setActiveTab] = useState<"categories" | "merchants" | "person" | "frequent">("categories");

  const shownCategories = categories.slice(0, 5);
  const shownMerchants = merchants.slice(0, 5);
  const shownFrequent = [...itemAnalytics].sort((a, b) => b.txn_count - a.txn_count).slice(0, 5);

  const hasPartner = !!partner && personBreakdown.length > 0;
  const personRows = hasPartner
    ? [
        { id: userId, label: "You" },
        { id: partner.id, label: partner.displayName.split(" ")[0] },
      ].map((person) => {
        const row = personBreakdown.find((p) => p.paid_by === person.id);
        const total = row ? parseFloat(row.total) : 0;
        return {
          ...person,
          total,
          txnCount: row?.txn_count ?? 0,
          avg: row ? parseFloat(row.avg_transaction) : 0,
          pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
        };
      })
    : [];

  return (
    <div className="flex flex-col justify-start rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-border">
      {/* Header & Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3.5">
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "categories"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <PieChart className="h-3.5 w-3.5 text-brand-primary" />
            <span>Categories</span>
          </button>

          {merchants.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("merchants")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "merchants"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Store className="h-3.5 w-3.5 text-indigo-500" />
              <span>Merchants</span>
            </button>
          )}

          {hasPartner && (
            <button
              type="button"
              onClick={() => setActiveTab("person")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "person"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5 text-amber-500" />
              <span>By Member</span>
            </button>
          )}

          {itemAnalytics.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("frequent")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "frequent"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Repeat className="h-3.5 w-3.5 text-violet-500" />
              <span>Frequent</span>
            </button>
          )}
        </div>

        <Link
          href="/analytics"
          className="flex items-center text-xs font-medium text-primary hover:underline"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Tab Panes */}
      <div className="pt-3">
        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div className="flex flex-col gap-3">
            {shownCategories.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No category data yet.</p>
            ) : (
              shownCategories.map((cat) => {
                const total = parseFloat(cat.total);
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                return (
                  <div key={cat.category_id} className="flex items-center gap-3">
                    <CategoryIcon
                      icon={cat.icon}
                      color={cat.color}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {cat.category_name}
                        </p>
                        <p className="shrink-0 text-xs sm:text-sm font-semibold text-foreground tabular-nums">
                          {formatINR(total)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="shrink-0 text-[10px] sm:text-[11px] text-muted-foreground">
                          {pct.toFixed(0)}% · {cat.txn_count}×
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Merchants Tab */}
        {activeTab === "merchants" && (
          <div className="flex flex-col divide-y divide-border/60">
            {shownMerchants.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No merchant data yet.</p>
            ) : (
              shownMerchants.map((m) => (
                <Link
                  key={m.merchant_id}
                  href={`/more/merchants/${m.merchant_id}`}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Store className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-medium text-foreground">{m.merchant_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.txn_count} purchase{m.txn_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs sm:text-sm font-semibold text-foreground tabular-nums">
                    {formatINR(m.total)}
                  </p>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Person Breakdown Tab */}
        {activeTab === "person" && (
          <div className="flex flex-col gap-3.5">
            {personRows.map((row) => (
              <div key={row.id}>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs sm:text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground tabular-nums">
                    {formatINR(row.total)}
                  </p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {row.pct.toFixed(0)}% · {row.txnCount} expense{row.txnCount === 1 ? "" : "s"} · avg {formatINR(row.avg)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Frequent Items Tab */}
        {activeTab === "frequent" && (
          <div className="flex flex-col divide-y divide-border/60">
            {shownFrequent.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No item frequency data yet.</p>
            ) : (
              shownFrequent.map((item) => (
                <div key={item.item_name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Repeat className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs sm:text-sm font-medium capitalize text-foreground">
                    {item.item_name}
                  </p>
                  <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {item.txn_count}× purchase{item.txn_count === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
