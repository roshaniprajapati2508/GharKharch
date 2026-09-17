"use client";

// CSV import: file -> parse -> preview/validate -> confirm (spec section 3).
// Matches the exact column headers exportExpensesCsv (lib/actions/reports.ts)
// produces, so a user's own exported CSV round-trips cleanly. Category and
// merchant names are matched case-insensitively against the household's real
// categories/merchants — an unmatched name is never silently turned into a
// new category/merchant, it's just left uncategorized/no-merchant.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, UploadCloud, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useHousehold } from "@/lib/context/household-context";
import { parseCsv } from "@/lib/csv-parse";
import { listCategoriesForHousehold } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { importExpensesFromCsv, type ValidatedImportRow, type ImportResultRow } from "@/lib/actions/reports";
import { expenseTypeEnum } from "@/lib/validations/expense";

type Step = 1 | 2 | 3;

interface ParsedRow {
  rowNumber: number; // 1-based, matching the CSV's data rows (excluding header)
  date: string;
  time: string;
  item: string;
  merchant: string;
  category: string;
  paidBy: string;
  paymentMethod: string;
  amountRaw: string;
  type: string;
  notes: string;
  errors: string[];
  resolvedCategoryName: string | null;
  resolvedMerchantName: string | null;
  resolvedPaidById: string;
}

const EXPECTED_HEADERS = ["Date", "Time", "Item", "Merchant", "Category", "Subcategory", "Paid By", "Payment Method", "Amount", "Type", "Notes"];

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export default function ImportCsvPage() {
  const { userId, displayName, partner } = useHousehold();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);

  const validCount = rows.filter((r) => r.errors.length === 0 && !excluded.has(r.rowNumber)).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setFileName(file.name);
      try {
        const text = await file.text();
        const table = parseCsv(text);
        if (table.length === 0) {
          toast.error("That file looks empty");
          setLoading(false);
          return;
        }

        const header = table[0].map(normalizeHeader);
        const idx = (name: string) => header.indexOf(name.toLowerCase());
        const col = {
          date: idx("date"),
          time: idx("time"),
          item: idx("item"),
          merchant: idx("merchant"),
          category: idx("category"),
          paidBy: idx("paid by"),
          paymentMethod: idx("payment method"),
          amount: idx("amount"),
          type: idx("type"),
          notes: idx("notes"),
        };

        if (col.date === -1 || col.item === -1 || col.amount === -1) {
          toast.error(`Missing required column(s). Expected headers like: ${EXPECTED_HEADERS.join(", ")}`);
          setLoading(false);
          return;
        }

        const [categoriesResult, merchantsResult] = await Promise.all([listCategoriesForHousehold(), listMerchantsForHousehold()]);
        const categoryNames = categoriesResult.data?.flat.map((c) => c.name) ?? [];
        const merchantNames = merchantsResult.data?.map((m) => m.name) ?? [];
        const categoryByLower = new Map(categoryNames.map((n) => [n.toLowerCase(), n]));
        const merchantByLower = new Map(merchantNames.map((n) => [n.toLowerCase(), n]));

        const dataRows = table.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));

        const parsed: ParsedRow[] = dataRows.map((r, i) => {
          const get = (index: number) => (index >= 0 ? (r[index] ?? "").trim() : "");
          const date = get(col.date);
          const item = get(col.item);
          const amountRaw = get(col.amount);
          const merchant = get(col.merchant);
          const category = get(col.category);
          const paidByText = get(col.paidBy);
          const paymentMethod = get(col.paymentMethod);
          const typeRaw = get(col.type).toLowerCase();
          const notes = get(col.notes);

          const errors: string[] = [];
          if (!date) errors.push("Missing date");
          else if (!isValidDate(date)) errors.push("Date must be YYYY-MM-DD");
          if (!item) errors.push("Missing item name");
          const amount = Number(amountRaw);
          if (!amountRaw) errors.push("Missing amount");
          else if (Number.isNaN(amount) || amount <= 0) errors.push("Amount must be a positive number");

          const resolvedCategoryName = category ? categoryByLower.get(category.toLowerCase()) ?? null : null;
          const resolvedMerchantName = merchant ? merchantByLower.get(merchant.toLowerCase()) ?? null : null;

          let resolvedPaidById = userId;
          const lowerPaidBy = paidByText.toLowerCase();
          if (lowerPaidBy && lowerPaidBy !== "you" && lowerPaidBy !== displayName.toLowerCase()) {
            if (partner && lowerPaidBy === partner.displayName.toLowerCase()) {
              resolvedPaidById = partner.id;
            }
            // else: falls back to the current user rather than guessing — never fabricated.
          }

          return {
            rowNumber: i + 1,
            date,
            time: get(col.time),
            item,
            merchant,
            category,
            paidBy: paidByText,
            paymentMethod,
            amountRaw,
            type: typeRaw,
            notes,
            errors,
            resolvedCategoryName,
            resolvedMerchantName,
            resolvedPaidById,
          };
        });

        setRows(parsed);
        setExcluded(new Set(parsed.filter((r) => r.errors.length > 0).map((r) => r.rowNumber)));
        setStep(2);
      } catch {
        toast.error("Couldn't read that file — make sure it's a valid CSV");
      } finally {
        setLoading(false);
      }
    },
    [userId, displayName, partner]
  );

  function toggleRow(rowNumber: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  const importableRows = useMemo<{ row: ParsedRow; input: ValidatedImportRow }[]>(() => {
    return rows
      .filter((r) => r.errors.length === 0 && !excluded.has(r.rowNumber))
      .map((r) => {
        const type = expenseTypeEnum.safeParse(r.type);
        const input: ValidatedImportRow = {
          expense_date: r.date,
          item_name: r.item,
          amount: Number(r.amountRaw),
          merchant_name: r.resolvedMerchantName,
          category_name: r.resolvedCategoryName,
          paid_by: r.resolvedPaidById,
          payment_method: r.paymentMethod || null,
          expense_type: type.success ? type.data : "household",
          notes: r.notes || null,
        };
        return { row: r, input };
      });
  }, [rows, excluded]);

  async function handleImport() {
    if (importableRows.length === 0) return;
    setImporting(true);
    const result = await importExpensesFromCsv(importableRows.map((r) => r.input));
    setImporting(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setResults(result.data.results);
    setStep(3);
    if (result.data.failed === 0) toast.success(`Imported ${result.data.succeeded} expense${result.data.succeeded === 1 ? "" : "s"}`);
    else toast.warning(`Imported ${result.data.succeeded}, ${result.data.failed} failed — see details below`);
  }

  function reset() {
    setStep(1);
    setFileName(null);
    setRows([]);
    setExcluded(new Set());
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Import expenses from CSV</h1>
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
            <UploadCloud className="mx-auto h-8 w-8 text-brand-primary" />
            <p className="mt-2 text-sm font-medium text-foreground">Choose a .csv file</p>
            <p className="mt-1 text-xs text-muted-foreground">Matches the format from Reports → CSV export.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button className="mt-4" onClick={() => fileInputRef.current?.click()} loading={loading}>
              Choose file
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Expected column format</p>
            <p className="mt-1">Required: <span className="font-medium text-foreground">Date</span> (YYYY-MM-DD), <span className="font-medium text-foreground">Item</span>, <span className="font-medium text-foreground">Amount</span> (positive number).</p>
            <p className="mt-1">Optional: Time, Merchant, Category, Paid By, Payment Method, Type (personal/household/shared), Notes.</p>
            <p className="mt-1">Category and Merchant are matched by name against your existing ones (case-insensitive) — an unrecognized name is left uncategorized rather than creating a new one.</p>
            <p className="mt-1">Column headers: {EXPECTED_HEADERS.join(", ")}</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {validCount} row{validCount === 1 ? "" : "s"} ready
                {errorCount > 0 && `, ${errorCount} row${errorCount === 1 ? "" : "s"} have errors`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Choose a different file
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Merchant</th>
                  <th className="px-2 py-2">Paid by</th>
                  <th className="px-2 py-2">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const hasError = r.errors.length > 0;
                  const isExcluded = excluded.has(r.rowNumber);
                  return (
                    <tr key={r.rowNumber} className={hasError ? "bg-destructive/5" : isExcluded ? "opacity-50" : ""}>
                      <td className="px-2 py-2">
                        <Checkbox checked={!isExcluded} onCheckedChange={() => toggleRow(r.rowNumber)} disabled={hasError} />
                      </td>
                      <td className="px-2 py-2 text-foreground">{r.date || "—"}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-foreground">{r.item || "—"}</td>
                      <td className="px-2 py-2 text-foreground">{r.amountRaw || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.resolvedCategoryName ?? (r.category ? `${r.category} (uncategorized)` : "—")}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.resolvedMerchantName ?? (r.merchant ? `${r.merchant} (no match)` : "—")}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {r.resolvedPaidById === userId ? "You" : partner?.displayName ?? "You"}
                      </td>
                      <td className="px-2 py-2">
                        {hasError ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> {r.errors.join("; ")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-brand-green">
                            <CheckCircle2 className="h-3 w-3 shrink-0" /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button onClick={handleImport} disabled={validCount === 0} loading={importing}>
            Import {validCount} expense{validCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      {step === 3 && results && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5 text-center">
            {importing ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-primary" />
            ) : (
              <>
                <p className="text-lg font-semibold text-foreground">
                  {results.filter((r) => r.success).length} succeeded
                  {results.some((r) => !r.success) && `, ${results.filter((r) => !r.success).length} failed`}
                </p>
              </>
            )}
          </div>

          {results.some((r) => !r.success) && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failures</p>
              {results
                .filter((r) => !r.success)
                .map((r) => (
                  <div key={r.row} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    Row {r.row} ({r.itemName || "unnamed"}): {r.reason}
                  </div>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              Import another file
            </Button>
            <Button asChild className="flex-1">
              <Link href="/expenses">View expenses</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
