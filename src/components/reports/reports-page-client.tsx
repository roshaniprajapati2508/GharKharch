"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileJson, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthlyReportView } from "@/components/reports/monthly-report-view";
import { useAddExpense, useOnExpenseSaved } from "@/lib/context/add-expense-context";
import { useHousehold } from "@/lib/context/household-context";
import { getReportData, exportExpensesCsv, exportExpensesJson, type ReportData } from "@/lib/actions/reports";
import type { CategoryScope } from "@/lib/actions/analytics";
import { CategoryScopeToggle } from "@/components/shared/category-scope-toggle";
import { downloadReportPdf } from "@/lib/pdf/report-pdf";
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  getPreviousMonthRange,
  getCustomDateRange,
  type DateRange,
} from "@/lib/date-utils";

type ReportPeriod = "today" | "week" | "month" | "lastMonth" | "custom";

const PERIODS: { key: ReportPeriod; label: string; resolve: () => DateRange }[] = [
  { key: "today", label: "Today", resolve: getTodayRange },
  { key: "week", label: "This week", resolve: () => getWeekRange() },
  { key: "month", label: "This month", resolve: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last month", resolve: getPreviousMonthRange },
];

import { getClientCachedData, setClientCachedData } from "@/lib/cache/client-cache";

const REPORT_CACHE_KEY = "report_month_data";

export function ReportsPageClient({ initialData }: { initialData?: ReportData | null }) {
  const { openAdd } = useAddExpense();
  const { userId, displayName, partner } = useHousehold();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [range, setRange] = useState<DateRange>(getMonthRange(0));
  const [data, setData] = useState<ReportData | null>(() => {
    if (initialData) {
      setClientCachedData(REPORT_CACHE_KEY, initialData);
      return initialData;
    }
    return getClientCachedData<ReportData>(REPORT_CACHE_KEY) ?? null;
  });
  const [loading, setLoading] = useState(() => !initialData && !getClientCachedData<ReportData>(REPORT_CACHE_KEY));
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  // All / Household Only / Business Only - same filter as Analytics, so a
  // report can be pulled for just the homemade business side or just
  // everyday household spend (spec: Task 4).
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("all");

  const load = useCallback(async (nextRange: DateRange, nextScope: CategoryScope) => {
    const isDefaultMonth = nextRange.start === getMonthRange(0).start && nextRange.end === getMonthRange(0).end && nextScope === "all";
    if (isDefaultMonth) {
      const cached = getClientCachedData<ReportData>(REPORT_CACHE_KEY);
      if (cached) {
        setData(cached);
        setLoading(false);
      }
    }
    const result = await getReportData(nextRange, nextScope);
    if (result.error !== null) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    setData(result.data);
    if (isDefaultMonth && result.data) {
      setClientCachedData(REPORT_CACHE_KEY, result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load(range, categoryScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOnExpenseSaved(
    useCallback(() => {
      load(range, categoryScope);
    }, [load, range, categoryScope])
  );

  function handlePeriodChange(nextPeriod: ReportPeriod, nextRange: DateRange) {
    setPeriod(nextPeriod);
    setRange(nextRange);
    setCustomOpen(false);
    load(nextRange, categoryScope);
  }

  function handleScopeChange(nextScope: CategoryScope) {
    setCategoryScope(nextScope);
    load(range, nextScope);
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

  function handleDownloadPdf() {
    if (!data) return;
    downloadReportPdf(data, { userId, displayName, partner: partner ? { id: partner.id, displayName: partner.displayName } : null });
    toast.success("PDF downloaded");
  }

  const hasActivity = data ? data.summary.txn_count > 0 : false;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        {hasActivity && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting} className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm">
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} disabled={exportingJson} className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm">
              <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm">
              <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden h-8 px-2.5 text-xs sm:inline-flex sm:h-9 sm:px-3 sm:text-sm">
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Print
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

      <CategoryScopeToggle value={categoryScope} onChange={handleScopeChange} />

      {customOpen && (
        <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 rounded-xl border border-border bg-surface p-3">
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
          <Button size="sm" onClick={applyCustomRange} disabled={!customStart || !customEnd} className="h-9">
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
