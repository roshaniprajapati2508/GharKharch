"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { analyzeExpense, type ExpenseAnalysis } from "@/lib/actions/expense-analysis";
import { formatINR } from "@/lib/utils";
import type { EnrichedExpense } from "@/lib/actions/expenses";

/**
 * Bottom sheet behind expense-row.tsx's "Analyze" menu item. Every line shown
 * here is a short, factual statement backed by a number `analyzeExpense`
 * computed via existing SQL breakdown functions — never an invented
 * narrative — and a line is simply left out when its underlying fact
 * couldn't be computed (spec section 2).
 */
export function AnalyzeExpenseSheet({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: EnrichedExpense | null;
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ExpenseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !expense) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the analysis fetch when the sheet opens for a new expense
    setLoading(true);
    setError(null);
    setAnalysis(null);
    analyzeExpense(expense.id).then((result) => {
      setLoading(false);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setAnalysis(result.data);
    });
  }, [open, expense]);

  const hasAnyFact =
    analysis &&
    (analysis.categoryShare || analysis.merchantComparison || analysis.monthImpact || analysis.similarExpenses.length > 0 || analysis.priceChange);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Analyze this expense</DrawerTitle>
          <DrawerDescription className="sr-only">Factual context about this expense compared to your household&apos;s spending.</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-3 px-5 pb-6">
          {expense && (
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-sm font-medium text-foreground">{expense.merchant_name ?? expense.item_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatINR(expense.amount)} · {expense.expense_date}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </div>
          )}

          {error && <p className="py-4 text-sm text-destructive">{error}</p>}

          {!loading && !error && analysis && !hasAnyFact && (
            <p className="py-4 text-sm text-muted-foreground">Not enough history yet to say anything meaningful about this expense.</p>
          )}

          {!loading && !error && analysis && (
            <div className="flex flex-col gap-2.5">
              {analysis.categoryShare && (
                <FactLine>
                  This expense is <strong>{analysis.categoryShare.sharePct.toFixed(1)}%</strong> of{" "}
                  <strong>{analysis.categoryShare.categoryName}</strong> spend this month ({formatINR(analysis.categoryShare.categoryMonthTotal)} total).
                </FactLine>
              )}

              {analysis.merchantComparison && (
                <FactLine>
                  At <strong>{analysis.merchantComparison.merchantName}</strong>, this is{" "}
                  {analysis.merchantComparison.diffPct === null ? (
                    "the first recorded transaction in the last 6 months."
                  ) : Math.abs(analysis.merchantComparison.diffPct) < 5 ? (
                    <>about typical for this merchant ({formatINR(analysis.merchantComparison.merchantAvg)} average, last 6 months).</>
                  ) : (
                    <>
                      <strong>{Math.abs(analysis.merchantComparison.diffPct).toFixed(0)}% {analysis.merchantComparison.diffPct > 0 ? "above" : "below"}</strong>{" "}
                      your average transaction there ({formatINR(analysis.merchantComparison.merchantAvg)}, last 6 months).
                    </>
                  )}
                </FactLine>
              )}

              {analysis.monthImpact && (
                <FactLine>
                  It accounts for <strong>{analysis.monthImpact.sharePct.toFixed(1)}%</strong> of this month&apos;s total spending (
                  {formatINR(analysis.monthImpact.monthTotal)}).
                </FactLine>
              )}

              {analysis.priceChange && analysis.priceChange.direction !== "stable" && (
                <FactLine>
                  Price appears <strong>{analysis.priceChange.direction}</strong> than your previous typical amount for{" "}
                  <strong>{expense?.item_name}</strong> ({formatINR(analysis.priceChange.recent)} vs. your usual {formatINR(analysis.priceChange.previousTypical)}
                  ) — based only on your own past purchases, not a market price.
                </FactLine>
              )}

              {analysis.similarExpenses.length > 0 && (
                <div className="mt-1">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Similar previous expenses</p>
                  <div className="flex flex-col gap-1">
                    {analysis.similarExpenses.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span className="truncate text-foreground">{s.itemName}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatINR(s.amount)} · {s.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function FactLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-brand-mint px-3 py-2.5 text-sm text-brand-primary">{children}</p>;
}
