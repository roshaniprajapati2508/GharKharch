"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import {
  getTodayRange,
  getLast7DaysRange,
  getLast30DaysRange,
  getMonthRange,
  getPreviousMonthRange,
  getCustomDateRange,
  type DateRange,
} from "@/lib/date-utils";
import type { PersonFilter } from "@/lib/actions/analytics";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type QuickPeriod = "today" | "7d" | "30d" | "month" | "lastMonth" | "custom";

const QUICK_PERIODS: { key: QuickPeriod; label: string; resolve: () => DateRange }[] = [
  { key: "today", label: "Today", resolve: getTodayRange },
  { key: "7d", label: "7D", resolve: getLast7DaysRange },
  { key: "30d", label: "30D", resolve: getLast30DaysRange },
  { key: "month", label: "This Month", resolve: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last Month", resolve: getPreviousMonthRange },
];

/** Dashboard-wide "who" + "when" filter (spec section 37: Household/Me/Wife, Today/7D/30D/This Month/Last Month/Custom). */
export function DashboardFilters({
  period,
  person,
  onPeriodChange,
  onPersonChange,
}: {
  period: QuickPeriod;
  person: PersonFilter;
  onPeriodChange: (period: QuickPeriod, range: DateRange) => void;
  onPersonChange: (person: PersonFilter) => void;
}) {
  const { displayName, partner } = useHousehold();
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const personOptions: { key: PersonFilter; label: string }[] = [
    { key: "household", label: "Household" },
    { key: "me", label: displayName.split(" ")[0] || "Me" },
    ...(partner ? [{ key: "partner" as const, label: partner.displayName.split(" ")[0] }] : []),
  ];

  function applyCustom() {
    if (!customStart || !customEnd) return;
    onPeriodChange("custom", getCustomDateRange(customStart, customEnd));
    setCustomOpen(false);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPeriodChange(p.key, p.resolve())}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              period === p.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                period === "custom"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="dash-custom-start">From</Label>
                <Input id="dash-custom-start" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="dash-custom-end">To</Label>
                <Input id="dash-custom-end" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1" />
              </div>
              <Button size="sm" onClick={applyCustom} disabled={!customStart || !customEnd}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground"
          >
            {personOptions.find((o) => o.key === person)?.label ?? "Household"}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1">
          <div className="flex flex-col">
            {personOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPersonChange(opt.key)}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm",
                  person === opt.key ? "bg-secondary font-medium text-secondary-foreground" : "text-foreground hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
