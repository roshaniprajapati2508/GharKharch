"use client";

import { useState } from "react";
import { BarChart3, CalendarDays, LineChart, ShieldCheck } from "lucide-react";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { ExecutiveCashflowCard } from "@/components/dashboard/executive-cashflow-card";
import { MiniPnlCard } from "@/components/analytics/mini-pnl-card";
import { CashflowWidget } from "@/components/dashboard/cashflow-widget";
import { SpendingCalendar } from "@/components/analytics/spending-calendar";
import { cn } from "@/lib/utils";
import { scrollActiveIntoCenter, useCenterActiveItem } from "@/lib/scroll-utils";
import type { CashflowSnapshot, ExecutiveCashflow } from "@/lib/actions/insights";
import type { BusinessPnl } from "@/lib/actions/analytics";
import type { Database } from "@/types/database";

type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];

interface FinancialHubCardProps {
  dailySpending: DailySpendingRow[];
  initialCashflow?: CashflowSnapshot | null;
  initialExecutiveCashflow?: ExecutiveCashflow | null;
  initialBusinessPnl?: BusinessPnl | null;
}

export function FinancialHubCard({
  dailySpending,
  initialCashflow,
  initialExecutiveCashflow,
  initialBusinessPnl,
}: FinancialHubCardProps) {
  const [activeTab, setActiveTab] = useState<"trend" | "cashflow" | "calendar">("trend");
  const containerRef = useCenterActiveItem<HTMLDivElement>(activeTab);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-border">
      {/* Header with Visualizer Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            {activeTab === "trend" ? (
              <LineChart className="h-4 w-4" />
            ) : activeTab === "cashflow" ? (
              <BarChart3 className="h-4 w-4" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">ઘરનો હિસાબ</h2>
        </div>

        {/* Tab Controls */}
        <div
          ref={containerRef}
          className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth max-w-full"
        >
          <button
            type="button"
            data-active={activeTab === "trend"}
            onClick={(e) => {
              scrollActiveIntoCenter(e.currentTarget);
              setActiveTab("trend");
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "trend"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LineChart className="h-3.5 w-3.5 text-brand-primary" />
            <span>રોજનો ખર્ચ</span>
          </button>
          <button
            type="button"
            data-active={activeTab === "cashflow"}
            onClick={(e) => {
              scrollActiveIntoCenter(e.currentTarget);
              setActiveTab("cashflow");
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "cashflow"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            <span>આવક-જાવક</span>
          </button>
          <button
            type="button"
            data-active={activeTab === "calendar"}
            onClick={(e) => {
              scrollActiveIntoCenter(e.currentTarget);
              setActiveTab("calendar");
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "calendar"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
            <span>કેલેન્ડર</span>
          </button>
        </div>
      </div>

      {/* Tab Panes */}
      <div className="pt-3">
        {activeTab === "trend" && (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
            <SpendingTrendChart dailySpending={dailySpending} />
          </div>
        )}

        {activeTab === "cashflow" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <ExecutiveCashflowCard initialData={initialExecutiveCashflow} />
              <MiniPnlCard initialData={initialBusinessPnl} />
            </div>
            <div>
              <CashflowWidget initialData={initialCashflow} />
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
            <SpendingCalendar />
          </div>
        )}
      </div>
    </div>
  );
}
