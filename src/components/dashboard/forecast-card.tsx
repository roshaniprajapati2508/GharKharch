"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { getHouseholdForecast, type HouseholdForecast } from "@/lib/actions/insights";

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
export function ForecastCard() {
  const [forecast, setForecast] = useState<HouseholdForecast | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getHouseholdForecast().then((result) => {
      if (result.error === null) setForecast(result.data);
      setLoaded(true);
    });
  }, []);

  if (!loaded || !forecast) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-primary">
        <TrendingUp className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          {formatINR(forecast.spentSoFar)} spent so far
          <span className="text-muted-foreground"> · ~{formatINR(forecast.projected)} projected by month end</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Estimate based on this month&apos;s pace ({forecast.daysElapsed} of {forecast.daysInMonth} days) — not a guarantee.
        </p>
      </div>
    </div>
  );
}
