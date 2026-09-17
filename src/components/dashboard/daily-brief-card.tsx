"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { getDailyWeeklySnapshot, getSpendingChanges, type DailyWeeklySnapshot, type SpendingChangesResult } from "@/lib/actions/insights";
import { getRecurringSummary, type RecurringWithCategory } from "@/lib/actions/recurring";
import { getQuickAddChips, type QuickAddChip } from "@/lib/actions/quick-add";
import { useQuickAddSave } from "@/lib/hooks/use-quick-add-save";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface BriefData {
  snapshot: DailyWeeklySnapshot;
  changes: SpendingChangesResult | null;
  nextRecurring: RecurringWithCategory | null;
}

/**
 * "Read this once a day" digest — a single compact card that composes what's
 * already computed elsewhere (today/week snapshot, this-month's category
 * movers, the soonest-due recurring bill) plus a few Quick Add chips, rather
 * than a new full screen. Deliberately replaces the standalone SnapshotCard
 * and SpendingChangesCard on the dashboard: those two plus this card would
 * have shown the same today/week/month-mover numbers twice on one page. Each
 * sub-row renders only when its source action actually has something to say
 * — never a placeholder for a missing insight or an empty recurring section.
 * The month-end forecast is deliberately NOT folded in here — see
 * ForecastCard — because a projection is a different kind of claim than
 * "what happened", and the product brief calls it out as its own capability.
 */
export function DailyBriefCard() {
  const [data, setData] = useState<BriefData | null>(null);
  const [chips, setChips] = useState<QuickAddChip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getDailyWeeklySnapshot(), getSpendingChanges(), getRecurringSummary(), getQuickAddChips(4)]).then(
      ([snapshotRes, changesRes, recurringRes, chipsRes]) => {
        if (snapshotRes.error === null) {
          setData({
            snapshot: snapshotRes.data,
            changes: changesRes.error === null ? changesRes.data : null,
            nextRecurring: recurringRes.error === null ? recurringRes.data.upcoming[0] ?? null : null,
          });
        }
        if (chipsRes.error === null) setChips(chipsRes.data);
        setLoaded(true);
      }
    );
  }, []);

  const { saveChip, savingChip } = useQuickAddSave();

  if (!loaded || !data) return null;

  const { snapshot, changes, nextRecurring } = data;
  const hasChange = snapshot.weekChangePct !== null;
  const isDown = hasChange && (snapshot.weekChangePct as number) <= 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">{greeting()}</h3>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">
            {formatINR(snapshot.todayTotal)} · {snapshot.todayCount} expense{snapshot.todayCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="h-8 w-px shrink-0 bg-border" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">This week</p>
          <p className="mt-0.5 flex items-center gap-1 text-base font-semibold text-foreground">
            {formatINR(snapshot.weekTotal)}
            {hasChange && (
              <span className={cn("flex items-center text-xs font-medium", isDown ? "text-brand-green" : "text-brand-orange")}>
                {isDown ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {Math.abs(snapshot.weekChangePct as number).toFixed(0)}%
              </span>
            )}
          </p>
        </div>
      </div>

      {changes && changes.changes.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{changes.summary}</p>}

      {nextRecurring && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <p className="min-w-0 truncate text-sm text-foreground">
            <span className="font-medium">{nextRecurring.name}</span>
            {nextRecurring.next_due_date && (
              <span className="text-muted-foreground">
                {" "}
                · due {new Date(nextRecurring.next_due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </p>
          <span className="shrink-0 text-sm font-medium text-foreground">{formatINR(Number(nextRecurring.amount))}</span>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip, i) => (
            <button
              key={`${chip.itemName}-${i}`}
              type="button"
              disabled={savingChip !== null}
              onClick={() => saveChip(chip)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-brand-mint/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-brand-mint disabled:opacity-50"
            >
              <span className="capitalize">{chip.merchantName ?? chip.itemName}</span>
              <span className="text-muted-foreground">{formatINR(chip.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
