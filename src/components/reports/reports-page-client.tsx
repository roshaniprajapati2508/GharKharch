"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileJson, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthlyReportView } from "@/components/reports/monthly-report-view";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { getReportData, exportExpensesCsv, exportExpensesJson, type ReportData } from "@/lib/actions/reports";
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  getPreviousMonthRange,
  getCustomDateRange,
  type DateRange,
} from "@/lib/date-utils";
import { getClientCachedData, setClientCachedData, invalidateClientCache } from "@/lib/cache/client-cache";

type ReportPeriod = "today" | "week" | "month" | "lastMonth" | "custom";

const PERIODS: { key: ReportPeriod; label: string; resolve: () => DateRange }[] = [
  { key: "today", label: "Today", resolve: getTodayRange },
  { key: "week", label: "This week", resolve: () => getWeekRange() },
  { key: "month", label: "This month", resolve: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last month", resolve: getPreviousMonthRange },
];

function getReportCacheKey(range: DateRange) {
  return `report_${range.start}_${range.end}`;
}

export function ReportsPageClient({ initialData }: { initialData?: ReportData | null }) {
  const { openAdd } = useAddExpense();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [range, setRange] = useState<DateRange>(initialData?.range ?? getMonthRange(0));

  const [data, setData] = useState<ReportData | null>(() => {
    if (initialData) {
      setClientCachedData(getReportCacheKey(initialData.range), initialData);
      return initialData;
    }
    return getClientCachedData<ReportData>(getReportCacheKey(getMonthRange(0)));
  });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const load = useCallback(async (nextRange: DateRange, forceFresh = false) => {
    const cacheKey = getReportCacheKey(nextRange);
    const cached = getClientCachedData<ReportData>(cacheKey);

    if (cached && !forceFresh) {
      setData(cached);
    } else if (!cached && !data) {
      setLoading(true);
    }

    const result = await getReportData(nextRange);
    setLoading(false);

    if (result.error !== null) {
      toast.error(result.error);
      return;
    }

    setClientCachedData(cacheKey, result.data);
    setData(result.data);
  }, [data]);

  useEffect(() => {
    if (!initialData && !data) {
       
      load(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(
    useCallback(() => {
      invalidateClientCache("report_");
      load(range, true);
    }, [load, range])
  );

  function handlePeriodChange(nextPeriod: ReportPeriod, nextRange: DateRange) {
    setPeriod(nextPeriod);
    setRange(nextRange);
    setCustomOpen(false);
    load(nextRange);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    handlePeriodChange("custom", getCustomDateRange(customStart, customEnd));
  }

  async function handleExportCsv() {
    setExporting(true);
    const result = await exportExpensesCsv(range);
    setExporting(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gharkharch-${range.start}-to-${range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  async function handleExportJson() {
    setExportingJson(true);
    const result = await exportExpensesJson(range);
    setExportingJson(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const blob = new Blob([result.data], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gharkharch-${range.start}-to-${range.end}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("JSON downloaded");
  }

  const hasActivity = data ? data.summary.txn_count > 0 : false;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="no-print flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        {hasActivity && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} disabled={exportingJson}>
              <FileJson className="h-4 w-4" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="no-print -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePeriodChange(p.key, p.resolve())}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              period === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            period === "custom" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"
          )}
        >
          Custom
        </button>
      </div>

      {customOpen && (
        <div className="no-print flex items-end gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            />
          </div>
          <Button size="sm" onClick={applyCustomRange} disabled={!customStart || !customEnd}>
            Apply
          </Button>
        </div>
      )}

      {loading && !data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      ) : !data || !hasActivity ? (
        <EmptyState
          title="Your first monthly report is on its way"
          description="Once you've logged a few expenses, a premium monthly summary will appear here."
          ctaLabel="Add an expense"
          onCta={openAdd}
          variant="chart"
        />
      ) : (
        <MonthlyReportView data={data} />
      )}
    </div>
  );
}
