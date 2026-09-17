"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR } from "@/lib/utils";
import { parseISODate, getTodayISO, getMonthRange, type DateRange } from "@/lib/date-utils";
import { getCalendarMonthData } from "@/lib/actions/analytics";
import { getExpenses, type EnrichedExpense } from "@/lib/actions/expenses";
import { ExpenseList } from "@/components/expenses/expense-list";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { softDeleteExpense, restoreExpense, duplicateExpense } from "@/lib/actions/expenses";
import { getClientCachedData, setClientCachedData, invalidateClientCache } from "@/lib/cache/client-cache";
import { useOnExpenseSaved } from "@/lib/context/add-expense-context";

interface DayCell {
  iso: string;
  day: number;
  total: number;
  txnCount: number;
}

function buildInitialCells(range: DateRange, rows: { expense_date: string; total: string; txn_count: number }[] = []): DayCell[] {
  const totalsByDate = new Map(rows.map((r) => [r.expense_date, { total: parseFloat(r.total), txnCount: r.txn_count }]));
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);
  const cells: DayCell[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const entry = totalsByDate.get(iso);
    cells.push({ iso, day: d.getUTCDate(), total: entry?.total ?? 0, txnCount: entry?.txnCount ?? 0 });
  }
  return cells;
}

type CalendarCachePayload = {
  range: DateRange;
  days: { expense_date: string; total: string; txn_count: number }[];
};

/** Calendar heatmap (spec section 8F, 33): tap a day to see that day's transactions. */
export function SpendingCalendar() {
  const [monthsAgo, setMonthsAgo] = useState(0);
  const initialRange = getMonthRange(0);

  const [monthLabel, setMonthLabel] = useState(initialRange.label);
  const [days, setDays] = useState<DayCell[]>(() => {
    const cached = getClientCachedData<CalendarCachePayload>("calendar_month_0");
    if (cached) {
      return buildInitialCells(cached.range, cached.days);
    }
    return buildInitialCells(initialRange);
  });
  const [loading, setLoading] = useState(() => !getClientCachedData<CalendarCachePayload>("calendar_month_0"));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayExpenses, setDayExpenses] = useState<EnrichedExpense[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<EnrichedExpense | null>(null);

  const load = useCallback(async (offset: number, forceFresh = false) => {
    const cacheKey = `calendar_month_${offset}`;
    const cached = getClientCachedData<CalendarCachePayload>(cacheKey);

    if (cached && !forceFresh) {
      setMonthLabel(cached.range.label);
      setDays(buildInitialCells(cached.range, cached.days));
      setLoading(false);
    } else {
      const fallbackRange = getMonthRange(offset);
      setMonthLabel(fallbackRange.label);
      if (days.length === 0) {
        setDays(buildInitialCells(fallbackRange));
      }
      setLoading(true);
    }

    const result = await getCalendarMonthData(offset);
    setLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const { range, days: rows } = result.data;
    setMonthLabel(range.label);
    setClientCachedData(cacheKey, { range, days: rows });
    setDays(buildInitialCells(range, rows));
  }, [days.length]);

  useEffect(() => {
    load(monthsAgo);
  }, [monthsAgo, load]);

  useOnExpenseSaved(
    useCallback(() => {
      invalidateClientCache("calendar_month_");
      load(monthsAgo, true);
    }, [load, monthsAgo])
  );

  const maxTotal = Math.max(1, ...days.map((d) => d.total));
  const leadingBlanks = days.length > 0 ? parseISODate(days[0].iso).getUTCDay() : 0;
  const today = getTodayISO();

  async function openDay(iso: string) {
    setSelectedDate(iso);
    setDayLoading(true);
    const result = await getExpenses({ start: iso, end: iso, sort: "newest", limit: 50 });
    setDayLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setDayExpenses(result.data);
  }

  async function refreshDay() {
    if (!selectedDate) return;
    openDay(selectedDate);
    load(monthsAgo);
  }

  async function handleDelete(expense: EnrichedExpense) {
    setDayExpenses((list) => list.filter((e) => e.id !== expense.id));
    const result = await softDeleteExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      refreshDay();
      return;
    }
    load(monthsAgo);
    toast("Expense deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          await restoreExpense(expense.id);
          refreshDay();
        },
      },
    });
  }

  async function handleDuplicate(expense: EnrichedExpense) {
    const result = await duplicateExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Duplicated · ${formatINR(expense.amount)}`);
    refreshDay();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthsAgo((m) => m + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
        <button
          type="button"
          onClick={() => setMonthsAgo((m) => Math.max(0, m - 1))}
          disabled={monthsAgo === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading && days.length === 0 ? (
        <div className="mt-3 h-56 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div className={cn("mt-3 grid grid-cols-7 gap-1.5 transition-opacity duration-200", loading && "opacity-60")}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((d) => {
            const intensity = d.total / maxTotal;
            const isToday = d.iso === today;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => openDay(d.iso)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
                  isToday && "ring-1 ring-primary"
                )}
                style={{
                  backgroundColor: d.total > 0 ? `rgba(8, 127, 110, ${0.12 + intensity * 0.65})` : "var(--muted)",
                  color: intensity > 0.5 ? "white" : "var(--foreground)",
                }}
              >
                {d.day}
              </button>
            );
          })}
        </div>
      )}

      <Drawer open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>{selectedDate ? parseISODate(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : ""}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {dayLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : (
              <ExpenseList expenses={dayExpenses} onEdit={setEditTarget} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AddExpenseSheet open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)} editExpense={editTarget} onSaved={refreshDay} />
    </div>
  );
}
