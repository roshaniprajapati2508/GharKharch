"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { TopExpensesList } from "@/components/analytics/top-expenses-list";
import { TopInflowsList } from "@/components/dashboard/top-inflows-list";
import { cn } from "@/lib/utils";
import type { TopExpenseRow } from "@/lib/actions/analytics";
import type { Database } from "@/types/database";

type CategoryBreakdownRow = Database["public"]["Functions"]["get_category_breakdown"]["Returns"][number];

interface TopTransactionsCardProps {
  topExpenses: TopExpenseRow[];
  topInflows?: TopExpenseRow[];
  categories: CategoryBreakdownRow[];
}

export function TopTransactionsCard({
  topExpenses,
  topInflows = [],
  categories,
}: TopTransactionsCardProps) {
  const [activeTab, setActiveTab] = useState<"debits" | "credits">("debits");
  const hasInflows = topInflows && topInflows.length > 0;

  if (topExpenses.length === 0 && !hasInflows) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {activeTab === "debits" ? (
            <TrendingDown className="h-4 w-4 text-rose-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          )}
          મોટા ખર્ચા અને આવક
        </h3>
        {hasInflows ? (
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("debits")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "debits"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="h-3 w-3 text-rose-500" />
              ખર્ચા ({topExpenses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("credits")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "credits"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
              આવક ({topInflows.length})
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            ખર્ચા
          </span>
        )}
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "debits" ? (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div>div:first-child]:hidden">
            <TopExpensesList expenses={topExpenses.slice(0, 5)} categories={categories} />
          </div>
        ) : (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div>div:first-child]:hidden">
            <TopInflowsList inflows={topInflows.slice(0, 5)} />
          </div>
        )}
      </div>
    </div>
  );
}
