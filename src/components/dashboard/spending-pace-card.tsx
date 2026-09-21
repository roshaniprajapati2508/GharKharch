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
  frugal: { color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", icon: TrendingDown, label: "Frugal / Controlled" },
  on_track: { color: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", bg: "bg-amber-500/10", icon: Minus, label: "On Track" },
  elevated: { color: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", bg: "bg-rose-500/10", icon: TrendingUp, label: "Elevated Spend" },
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
export function SpendingPaceCard({ initialData }: { initialData?: SpendingPaceBenchmark | null }) {
  const [data, setData] = useState<SpendingPaceBenchmark | null | undefined>(
    initialData !== undefined ? initialData : undefined
  );
  const [baseline, setBaseline] = useState<Baseline>("6m");

  async function load() {
    const result = await getSpendingPaceBenchmark();
    setData(result.error ? null : result.data);
  }

  useEffect(() => {
    if (initialData === undefined) {
      load();
    }
  }, [initialData]);

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
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-4.5 shadow-xs backdrop-blur-md space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Gauge className="h-4 w-4 text-brand-primary" /> Spending Pace
        </h3>
        <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-muted/50 p-0.5">
          {(["3m", "6m", "12m"] as Baseline[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBaseline(b)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer",
                baseline === b
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              vs {BASELINE_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.bg)}>
          <Icon className={cn("h-4.5 w-4.5", style.color)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-bold", style.color)}>{style.label}</p>
          <p className="text-xs text-muted-foreground leading-snug">
            {active.pct === 0
              ? `Pacing right with typical Day ${data.currentDay} spend`
              : `${Math.abs(active.pct)}% ${active.pct < 0 ? "slower" : "ahead"} vs ${BASELINE_LABEL[baseline]}`}
            {active.status === "frugal" && projectedDelta < 0 && ` (Saved ~${formatINR(Math.abs(projectedDelta))})`}
            {active.status === "elevated" && projectedDelta > 0 && ` (+~${formatINR(projectedDelta)})`}
          </p>
        </div>
      </div>

      {/* Segmented month-progress bar */}
      <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
          <div
            className={cn("h-full rounded-full transition-all duration-500", style.bar)}
            style={{ width: `${Math.min(100, data.projectedMonthEnd > 0 ? (data.currentMtdSpend / data.projectedMonthEnd) * 100 : 0)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>MTD: <strong className="text-foreground font-semibold">{formatINR(data.currentMtdSpend)}</strong></span>
          <span>Projected: <strong className="text-foreground font-semibold">{formatINR(data.projectedMonthEnd)}</strong></span>
        </div>
      </div>
    </div>
  );
}
