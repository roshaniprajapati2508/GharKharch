"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
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
  { key: "today", label: "આજ (Today)", resolve: getTodayRange },
  { key: "7d", label: "૭ દિવસ (7D)", resolve: getLast7DaysRange },
  { key: "30d", label: "૩૦ દિવસ (30D)", resolve: getLast30DaysRange },
  { key: "month", label: "આ મહિનો (Month)", resolve: () => getMonthRange(0) },
  { key: "lastMonth", label: "ગયો મહિનો (Last)", resolve: getPreviousMonthRange },
];

export function DashboardFilters({
  period,
  onPeriodChange,
}: {
  period: QuickPeriod;
  person?: PersonFilter;
  onPeriodChange: (period: QuickPeriod, range: DateRange) => void;
  onPersonChange?: (person: PersonFilter) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function applyCustom() {
    if (!customStart || !customEnd) return;
    onPeriodChange("custom", getCustomDateRange(customStart, customEnd));
    setCustomOpen(false);
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5">
      <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPeriodChange(p.key, p.resolve())}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              period === p.key
                ? "border-primary bg-primary text-primary-foreground font-semibold"
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
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              તારીખ પસંદ કરો (Custom)
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
    </div>
  );
}
