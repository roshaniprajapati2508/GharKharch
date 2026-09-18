"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { getSpendingPaceBenchmark, type SpendingPaceBenchmark } from "@/lib/actions/insights";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { formatINR, cn } from "@/lib/utils";

type Baseline = "3m" | "6m" | "12m";

const BASELINE_LABEL: Record<Baseline, string> = { "3m": "3M Avg", "6m": "6M Avg", "12m": "12M Avg" };

function statusFor(currentMtd: number, avg: number): { pct: number; status: "frugal" | "on_track" | "elevated" } {
  if (avg <= 0) return { pct: 0, status: "on_track" };
  const pct = Math.round(((currentMtd - avg) / avg) * 1000) / 10;
  const status = pct <= -5 ? "frugal" : pct >= 10 ? "elevated" : "on_track";
  return { pct, status };
}

const STATUS_STYLE = {
  frugal: { color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", icon: TrendingDown, label: "Frugal / Controlled" },
  on_track: { color: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", icon: Minus, label: "On Track" },
  elevated: { color: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", icon: TrendingUp, label: "Elevated Spend" },
} as const;

/**
 * Rolling Spending Pace & Historical Benchmark gauge (spec: Feature 2) -
 * "are we spending faster or slower than usual at this point in the
 * month", compared against the household's own 3/6/12-month rolling
 * medians (well, means - get_spending_pace_benchmark averages rather than
 * takes a true median, since Postgres has no built-in fast median and this
 * is a lightweight pace signal, not a statistical report). Segmented bar
 * rather than a literal speedometer arc/SVG gauge, matching this app's
 * other dashboard widgets (CashflowWidget's inflow/outflow bar).
 */
export function SpendingPaceCard() {
  const [data, setData] = useState<SpendingPaceBenchmark | null | undefined>(undefined);
  const [baseline, setBaseline] = useState<Baseline>("6m");

  async function load() {
    const result = await getSpendingPaceBenchmark();
    setData(result.error ? null : result.data);
  }

  useEffect(() => {
    load();
  }, []);

  useOnExpenseSaved(load);

  const active = useMemo(() => {
    if (!data) return null;
    const avg = baseline === "3m" ? data.avg3mMtdSpend : baseline === "12m" ? data.avg12mMtdSpend : data.avg6mMtdSpend;
    return statusFor(data.currentMtdSpend, avg);
  }, [data, baseline]);

  if (!data || !active) return null;
  // No history to compare against yet (a brand-new household) - showing a
  // "0% ahead of ₹0" card would be noise, not signal.
  const baselineAvg = baseline === "3m" ? data.avg3mMtdSpend : baseline === "12m" ? data.avg12mMtdSpend : data.avg6mMtdSpend;
  if (data.currentMtdSpend === 0 && baselineAvg === 0) return null;

  const style = STATUS_STYLE[active.status];
  const Icon = style.icon;
  const projectedDelta = data.projectedMonthEnd - baselineAvg;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" /> Spending Pace
        </p>
        <div className="flex gap-1">
          {(["3m", "6m", "12m"] as Baseline[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBaseline(b)}
              className={cn(
                "min-h-6 rounded-full px-2 text-[10px] font-semibold transition-colors",
                baseline === b ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              vs {BASELINE_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.bar, "bg-opacity-10")}>
          <Icon className={cn("h-4.5 w-4.5", style.color)} />
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-bold", style.color)}>{style.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {active.pct === 0
              ? `Pacing right with your typical Day ${data.currentDay} spend`
              : `${Math.abs(active.pct)}% ${active.pct < 0 ? "slower" : "ahead of"} your ${BASELINE_LABEL[baseline]} pace at Day ${data.currentDay}`}
            {active.status === "frugal" && projectedDelta < 0 && ` (Projected savings: ~${formatINR(Math.abs(projectedDelta))})`}
            {active.status === "elevated" && projectedDelta > 0 && ` (Projected overage: ~${formatINR(projectedDelta)})`}
          </p>
        </div>
      </div>

      {/* Segmented month-progress bar - filled portion is today's MTD spend relative to the projected month-end total, colored by pace status. */}
      <div className="space-y-1">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", style.bar)}
            style={{ width: `${Math.min(100, data.projectedMonthEnd > 0 ? (data.currentMtdSpend / data.projectedMonthEnd) * 100 : 0)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>MTD: {formatINR(data.currentMtdSpend)}</span>
          <span>Day {data.currentDay}/{data.daysInMonth} · Projected: {formatINR(data.projectedMonthEnd)}</span>
        </div>
      </div>
    </div>
  );
}
