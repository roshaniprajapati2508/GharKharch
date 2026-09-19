"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { getHouseholdForecast, type HouseholdForecast } from "@/lib/actions/insights";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

/**
 * Household-wide month-end spending projection (product brief section 3.1,
 * Phase 4 priority #4). Deliberately its own small card, not folded into
 * DailyBriefCard: a forecast is a labeled *estimate* about the future, a
 * different kind of claim from the brief's "what happened today/this week"
 * facts, and the brief explicitly calls it out as a standalone capability.
 * Renders nothing (not an empty-state card) when there's too little of the
 * month elapsed, or nothing spent yet, to extrapolate from — see the guard
 * logic in `getHouseholdForecast()`.
 */
export function ForecastCard({
  initialForecast,
}: {
  initialForecast?: HouseholdForecast | null;
} = {}) {
  const [forecast, setForecast] = useState<HouseholdForecast | null>(initialForecast ?? null);
  const [loaded, setLoaded] = useState(initialForecast !== undefined);

  const load = useCallback(() => {
    getHouseholdForecast().then((result) => {
      if (result.error === null) setForecast(result.data);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (initialForecast === undefined) {
      load();
    }
  }, [initialForecast, load]);

  useOnExpenseSaved(load);

  if (!loaded || !forecast) return null;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-4.5 shadow-xs backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-brand-primary" /> Month Forecast
        </h3>
        <span className="rounded-full bg-brand-mint/80 px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
          Day {forecast.daysElapsed}/{forecast.daysInMonth}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Spent so far</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {formatINR(forecast.spentSoFar)}
          </p>
          <p className="text-[11px] text-muted-foreground">{forecast.daysElapsed} days logged</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Projected</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            ~{formatINR(forecast.projected)}
          </p>
          <p className="text-[11px] text-muted-foreground">by month end</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
        Estimate based on current pace ({Math.round((forecast.daysElapsed / forecast.daysInMonth) * 100)}% of month elapsed).
      </div>
    </div>
  );
}
