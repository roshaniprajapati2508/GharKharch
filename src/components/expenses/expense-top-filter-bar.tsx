"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Tag,
  User,
  CreditCard,
  Search,
  X,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import {
  getTodayRange,
  getLast7DaysRange,
  getLast30DaysRange,
  getMonthRange,
  getPreviousMonthRange,
} from "@/lib/date-utils";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { AppliedFilters } from "@/components/expenses/expense-filters-sheet";
import type { ExpenseFilters } from "@/lib/actions/expenses";
import type { Tables } from "@/types/database";

const QUICK_RANGES = [
  { key: "all", label: "All time", get: () => ({ start: undefined, end: undefined }) },
  { key: "today", label: "Today", get: getTodayRange },
  { key: "7d", label: "Last 7 days", get: getLast7DaysRange },
  { key: "30d", label: "Last 30 days", get: getLast30DaysRange },
  { key: "month", label: "This month", get: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last month", get: getPreviousMonthRange },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest amount" },
  { value: "lowest", label: "Lowest amount" },
] as const;

const QUICK_PAYMENT_METHODS = ["UPI", "Cash", "Credit Card", "Bank Transfer", "Debit Card"];

export function ExpenseTopFilterBar({
  filters,
  onApply,
  categories,
  paymentMethods = [],
  onOpenMoreFilters,
}: {
  filters: AppliedFilters;
  onApply: (next: AppliedFilters) => void;
  categories: CategoryWithChildren[];
  paymentMethods?: Tables<"payment_methods">[];
  onOpenMoreFilters?: () => void;
}) {
  const { userId, displayName, partner } = useHousehold();
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [customStart, setCustomStart] = useState(filters.start ?? "");
  const [customEnd, setCustomEnd] = useState(filters.end ?? "");

  const activeCount = Object.keys(filters).filter((k) => {
    const val = filters[k as keyof AppliedFilters];
    if (k === "rangeKey" && val === "all") return false;
    if (k === "entryType" && (val === "all" || !val)) return false;
    if (k === "paidBy" && (val === "all" || !val)) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return val !== undefined && val !== null && val !== "";
  }).length;

  function updateFilter<K extends keyof AppliedFilters>(key: K, value: AppliedFilters[K]) {
    const next = { ...filters };
    if (value === undefined || value === null || value === "all") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onApply(next);
  }

  function handleRangeSelect(rangeKey: string) {
    const found = QUICK_RANGES.find((r) => r.key === rangeKey);
    if (!found) return;
    const next = { ...filters };
    if (rangeKey === "all") {
      delete next.rangeKey;
      delete next.start;
      delete next.end;
    } else {
      const dates = found.get();
      next.rangeKey = rangeKey;
      next.start = dates.start;
      next.end = dates.end;
    }
    onApply(next);
  }

  function handleCustomRangeApply() {
    if (!customStart && !customEnd) return;
    const next = {
      ...filters,
      rangeKey: "custom",
      start: customStart || undefined,
      end: customEnd || undefined,
    };
    onApply(next);
    setCustomPopoverOpen(false);
  }

  function clearAllFilters() {
    onApply({});
  }

  // Label for date range button
  const dateRangeLabel = (() => {
    if (filters.rangeKey === "custom" || (filters.start && filters.end)) {
      return `${filters.start ?? "Start"} → ${filters.end ?? "End"}`;
    }
    const match = QUICK_RANGES.find((r) => r.key === filters.rangeKey);
    return match ? match.label : "Period";
  })();

  // Label for category button
  const categoryLabel = (() => {
    if (!filters.categoryIds || filters.categoryIds.length === 0) return "Category";
    if (filters.categoryIds.length === 1) {
      const cat = categories.find((c) => c.id === filters.categoryIds?.[0]);
      return cat ? cat.name : "1 Category";
    }
    return `${filters.categoryIds.length} Categories`;
  })();

  // Label for payer button
  const payerLabel = (() => {
    if (!filters.paidBy || filters.paidBy === "all") return "Paid by";
    if (filters.paidBy === userId) return "Paid by: You";
    if (partner && filters.paidBy === partner.id) return `Paid by: ${partner.displayName}`;
    return "Paid by";
  })();

  // Label for payment method
  const paymentMethodLabel = filters.paymentMethod ? filters.paymentMethod : "Payment method";

  // Label for sorting
  const sortLabel = SORT_OPTIONS.find((s) => s.value === (filters.sort ?? "newest"))?.label ?? "Sort";

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3 backdrop-blur-xs shadow-xs">
      {/* Top row: Type Segmented Toggle & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Entry Type Toggle (Spend vs Income vs All) */}
        <div className="inline-flex rounded-xl bg-muted/80 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => updateFilter("entryType", "all")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all",
              !filters.entryType || filters.entryType === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => updateFilter("entryType", "expense")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all",
              filters.entryType === "expense"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Spend only
          </button>
          <button
            type="button"
            onClick={() => updateFilter("entryType", "income")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all",
              filters.entryType === "income"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            + Incoming only
          </button>
        </div>

        {/* Right side: Sort + More Filters + Clear all */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{sortLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Sort expenses</DropdownMenuLabel>
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => updateFilter("sort", opt.value as ExpenseFilters["sort"])}
                  className={cn(
                    "text-xs",
                    (filters.sort ?? "newest") === opt.value && "font-semibold text-brand-primary"
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onOpenMoreFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMoreFilters}
              className="h-8.5 gap-1.5 rounded-xl text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">All Filters</span>
            </Button>
          )}

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8.5 gap-1 rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Reset all filters"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear ({activeCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bottom row: Direct Dropdown Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
        {/* Date Range Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none",
              filters.rangeKey || filters.start || filters.end
                ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary font-semibold"
                : "border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>{dateRangeLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Select date range</DropdownMenuLabel>
            {QUICK_RANGES.map((r) => (
              <DropdownMenuItem
                key={r.key}
                onClick={() => handleRangeSelect(r.key)}
                className={cn(
                  "text-xs",
                  (filters.rangeKey === r.key || (!filters.rangeKey && r.key === "all")) &&
                    "font-semibold text-brand-primary"
                )}
              >
                {r.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="p-1">
              <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    Custom date range…
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3">
                  <div className="flex flex-col gap-2.5">
                    <p className="text-xs font-semibold text-foreground">Pick custom range</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground">Start date</label>
                        <Input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground">End date</label>
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleCustomRangeApply} className="h-8 text-xs mt-1">
                      Apply range
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Category Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none",
              filters.categoryIds && filters.categoryIds.length > 0
                ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary font-semibold"
                : "border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>{categoryLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Filter by category</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => updateFilter("categoryIds", undefined)}
              className={cn("text-xs", (!filters.categoryIds || filters.categoryIds.length === 0) && "font-semibold text-brand-primary")}
            >
              All Categories
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((cat) => {
              const isSelected = filters.categoryIds?.includes(cat.id);
              return (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => {
                    const current = filters.categoryIds ?? [];
                    if (current.includes(cat.id)) {
                      const updated = current.filter((id) => id !== cat.id);
                      updateFilter("categoryIds", updated.length > 0 ? updated : undefined);
                    } else {
                      updateFilter("categoryIds", [cat.id]);
                    }
                  }}
                  className={cn("text-xs justify-between", isSelected && "font-semibold text-brand-primary bg-brand-primary/10")}
                >
                  <span>{cat.name}</span>
                  {isSelected && <span className="text-[10px] text-brand-primary">✓</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Who Paid / Member Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none",
              filters.paidBy && filters.paidBy !== "all"
                ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary font-semibold"
                : "border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>{payerLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Paid or received by</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => updateFilter("paidBy", "all")}
              className={cn("text-xs", (!filters.paidBy || filters.paidBy === "all") && "font-semibold text-brand-primary")}
            >
              Household (Everyone)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateFilter("paidBy", userId)}
              className={cn("text-xs", filters.paidBy === userId && "font-semibold text-brand-primary")}
            >
              You ({displayName})
            </DropdownMenuItem>
            {partner && (
              <DropdownMenuItem
                onClick={() => updateFilter("paidBy", partner.id)}
                className={cn("text-xs", filters.paidBy === partner.id && "font-semibold text-brand-primary")}
              >
                {partner.displayName}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Payment Method Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none",
              filters.paymentMethod
                ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary font-semibold"
                : "border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{paymentMethodLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Payment method</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => updateFilter("paymentMethod", undefined)}
              className={cn("text-xs", !filters.paymentMethod && "font-semibold text-brand-primary")}
            >
              All Payment Methods
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Array.from(
              new Set([
                ...(paymentMethods.map((p) => p.name)),
                ...QUICK_PAYMENT_METHODS,
              ])
            ).map((method) => (
              <DropdownMenuItem
                key={method}
                onClick={() => updateFilter("paymentMethod", method)}
                className={cn("text-xs", filters.paymentMethod === method && "font-semibold text-brand-primary")}
              >
                {method}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
