"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, NotebookPen, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseScratchpadText, resolveScratchpadLine, type ResolvedScratchpadRow } from "@/lib/scratchpad-parser";
import {
  getScratchpadDraft,
  saveScratchpadDraft,
  clearScratchpadDraft,
  getScratchpadQuickSuggestions,
  type ScratchpadSuggestion,
} from "@/lib/actions/scratchpad";
import { bulkCreateExpenses, type ScratchpadExpenseInput } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO } from "@/lib/date-utils";
import { cn, formatINR } from "@/lib/utils";
import type { Tables } from "@/types/database";

const EXAMPLE = `Rickshaw 40
Chai 20 cash
Xerox 150 satyam upi
Doodh 60 amul
Amazon seller payout 4500 income`;

/**
 * Fast Expense Scratchpad (spec: Feature 1) - a freeform multi-line
 * notepad for typing/voice-pasting several transactions at once, parsed
 * client-side at 0ms (scratchpad-parser.ts) into an editable review table,
 * then converted to real expenses in one batch call. Autosaves to
 * scratchpad_drafts (migration 026) so a half-typed list survives a tab
 * close or app switch.
 */
export default function ScratchpadPage() {
  const { userId, displayName, partner } = useHousehold();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>([]);
  const [rows, setRows] = useState<ResolvedScratchpadRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggestionTab, setSuggestionTab] = useState<"frequent" | "business" | "household" | "income">("frequent");
  const [suggestions, setSuggestions] = useState<{
    historySuggestions: ScratchpadSuggestion[];
    businessSuggestions: ScratchpadSuggestion[];
    householdSuggestions: ScratchpadSuggestion[];
    incomeSuggestions: ScratchpadSuggestion[];
  }>({
    historySuggestions: [],
    businessSuggestions: [],
    householdSuggestions: [],
    incomeSuggestions: [],
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useMemo(
    () => [{ id: userId, displayName }, ...(partner ? [{ id: partner.id, displayName: partner.displayName }] : [])],
    [userId, displayName, partner]
  );

  useEffect(() => {
    Promise.all([
      getScratchpadDraft(),
      listCategoriesForHousehold(),
      listMerchantsForHousehold(),
      getScratchpadQuickSuggestions(),
    ]).then(([draft, cats, merch, sugg]) => {
      if (draft.data) setText(draft.data);
      if (cats.data) setCategoryTree(cats.data.tree);
      if (merch.data) setMerchants(merch.data);
      if (sugg.data) setSuggestions(sugg.data);
      setLoaded(true);
    });
  }, []);

  // Debounced autosave - a light round trip every couple of seconds while
  // typing, not on every keystroke.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveScratchpadDraft(text);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [text, loaded]);

  // Live "Parse & Review" table - re-parses at 0ms on every text change,
  // preserving any manual dropdown/amount overrides on rows whose text hasn't changed.
  useEffect(() => {
    const parsed = parseScratchpadText(text);
    setRows((prev) => {
      const prevMap = new Map(prev.map((r) => [r.raw, r]));
      return parsed.map((p) => {
        const fresh = resolveScratchpadLine(p, categoryTree, merchants, members, userId);
        const existing = prevMap.get(p.raw);
        if (existing) {
          return {
            ...fresh,
            itemName: existing.itemName,
            amount: existing.amount,
            categoryId: existing.categoryId,
            categoryName: existing.categoryName,
            subcategoryId: existing.subcategoryId,
            subcategoryName: existing.subcategoryName,
            merchantId: existing.merchantId,
            merchantName: existing.merchantName,
            paidBy: existing.paidBy,
            paymentMethod: existing.paymentMethod,
            entryType: existing.entryType,
          };
        }
        return fresh;
      });
    });
  }, [text, categoryTree, merchants, members, userId]);

  function updateRow(lineNumber: number, patch: Partial<ResolvedScratchpadRow>) {
    setRows((list) => list.map((r) => (r.lineNumber === lineNumber ? { ...r, ...patch } : r)));
  }

  function removeRow(lineNumber: number) {
    setRows((list) => list.filter((r) => r.lineNumber !== lineNumber));
    setText((t) =>
      t
        .split("\n")
        .filter((_, i) => i + 1 !== lineNumber)
        .join("\n")
    );
  }

  const readyRows = rows.filter((r) => r.amount && r.amount > 0 && r.itemName.trim());
  const validRows = readyRows.filter((r) => r.categoryId && r.paidBy);
  const invalidCount = rows.length - validRows.length;
  const totalAmount = readyRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  async function handleSaveAll() {
    const payload: ScratchpadExpenseInput[] = readyRows.map((r) => ({
      amount: r.amount as number,
      item_name: r.itemName,
      category_id: r.categoryId ?? "",
      subcategory_id: r.subcategoryId,
      merchant_id: r.merchantId,
      paid_by: r.paidBy,
      payment_method: r.paymentMethod,
      entry_type: r.entryType,
      expense_date: getTodayISO(),
    }));
    if (payload.length === 0) {
      toast.error("Nothing ready to save yet");
      return;
    }
    setSaving(true);
    const result = await bulkCreateExpenses(payload);
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const { successCount, results } = result.data;
    const failed = results.filter((r) => !r.success);
    if (successCount > 0) {
      toast.success(`Saved ${successCount} expense${successCount === 1 ? "" : "s"} to GharKharch`);
      setText("");
      clearScratchpadDraft();
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} row${failed.length === 1 ? "" : "s"} couldn't be saved - check category/payer`);
    }
  }

  function handleBulkPayer(memberId: string) {
    setRows((list) => list.map((r) => ({ ...r, paidBy: memberId })));
    toast.success("Updated payer for all rows");
  }

  function handleBulkPaymentMethod(method: string) {
    setRows((list) => list.map((r) => ({ ...r, paymentMethod: method })));
    toast.success(`Updated payment method to ${method} for all rows`);
  }

  function appendExample(sample: string) {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${sample}` : sample));
  }

  const currentChips = useMemo(() => {
    switch (suggestionTab) {
      case "frequent":
        return suggestions.historySuggestions.length > 0
          ? suggestions.historySuggestions
          : [
              { id: "def-dmart", label: "🛒 Dmart Grocery", template: "Dmart grocery 1200 upi", source: "household" as const },
              { id: "def-milk", label: "🥛 Amul Milk", template: "Doodh 60 amul upi", source: "household" as const },
              { id: "def-chai", label: "☕ Chai & Snacks", template: "Chai 40 cash", source: "household" as const },
              { id: "def-auto", label: "🛺 Auto Rickshaw", template: "Auto rickshaw 50 upi", source: "household" as const },
              { id: "def-amazon", label: "📦 Amazon Order", template: "Amazon shopping 450 card", source: "household" as const },
            ];
      case "business":
        return suggestions.businessSuggestions;
      case "household":
        return suggestions.householdSuggestions;
      case "income":
        return suggestions.incomeSuggestions;
      default:
        return [];
    }
  }, [suggestionTab, suggestions]);

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/more" prefetch={true} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <NotebookPen className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Scratchpad</h1>
            <p className="text-xs text-muted-foreground">Multi-line instant entry with 0ms smart parser</p>
          </div>
        </div>

        {text.trim() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              clearScratchpadDraft();
              toast.success("Scratchpad cleared");
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Quick Add Section with Category Tabs */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            ⚡ Quick Add Templates:
          </span>
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { key: "frequent", label: "⚡ Most Used" },
              { key: "business", label: "💼 Homemade Business" },
              { key: "household", label: "🏠 Household" },
              { key: "income", label: "💰 Payouts" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSuggestionTab(tab.key as typeof suggestionTab)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0",
                  suggestionTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chips List */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {currentChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => appendExample(chip.template)}
              className="shrink-0 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-xs"
              title={`Add line: ${chip.template}`}
            >
              + {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Textarea */}
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type one item per line, e.g.:\nRickshaw 40\nChai 20 cash\nAmazon 450 card Harsh\nDoodh 60 amul\nMeesho payout 1500 income`}
          rows={6}
          className="max-h-[35dvh] min-h-32 resize-y overflow-y-auto rounded-xl border-border/80 bg-surface/80 p-3.5 font-mono text-sm leading-relaxed shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-primary"
        />
        {text.trim() && (
          <span className="absolute bottom-2.5 right-3 text-[11px] font-medium text-muted-foreground">
            {rows.length} {rows.length === 1 ? "line" : "lines"}
          </span>
        )}
      </div>

      {/* Review Section */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {/* Summary & Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Parsed Total ({rows.length} items)</p>
                <p className="text-lg font-bold text-foreground">{formatINR(totalAmount)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {invalidCount > 0 ? (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {invalidCount} need category/payer
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ✓ All {readyRows.length} ready
                </span>
              )}
            </div>
          </div>

          {/* Quick Bulk Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2 text-xs">
            <span className="font-semibold text-muted-foreground">Quick Bulk:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleBulkPayer(m.id)}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  All {m.displayName.split(" ")[0]}
                </button>
              ))}
              <span className="text-border">|</span>
              {["UPI", "Cash", "Credit Card"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleBulkPaymentMethod(method)}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  All {method}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2.5 sm:hidden">
            {rows.map((row) => (
              <ScratchpadRowCard
                key={row.lineNumber}
                row={row}
                categoryTree={categoryTree}
                members={members}
                onChange={(patch) => updateRow(row.lineNumber, patch)}
                onRemove={() => removeRow(row.lineNumber)}
              />
            ))}
          </div>

          {/* Tablet/Desktop Table */}
          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-surface shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5">Item Name</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Merchant</th>
                    <th className="px-3 py-2.5">Amount (₹)</th>
                    <th className="px-3 py-2.5">Paid By</th>
                    <th className="px-3 py-2.5">Method</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((row) => (
                    <tr
                      key={row.lineNumber}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        (!row.categoryId || !row.paidBy) && "bg-amber-500/5"
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          value={row.itemName}
                          onChange={(e) => updateRow(row.lineNumber, { itemName: e.target.value })}
                          placeholder="Item name"
                          className="h-9 w-full min-w-[140px] rounded-md border border-transparent bg-transparent px-2 text-sm font-medium focus:border-input focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.categoryId ?? ""}
                          onChange={(e) => {
                            const cat = categoryTree.find((c) => c.id === e.target.value);
                            updateRow(row.lineNumber, {
                              categoryId: e.target.value || null,
                              categoryName: cat?.name ?? null,
                              subcategoryId: null,
                              subcategoryName: null,
                            });
                          }}
                          className={cn(
                            "h-9 min-w-[130px] rounded-md border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary",
                            row.categoryId ? "border-input" : "border-amber-500/80 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          <option value="">Choose Category...</option>
                          {categoryTree.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded bg-muted/60 px-2 py-0.5 text-xs text-foreground">
                          {row.merchantName ?? "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-xs text-muted-foreground font-semibold">₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={row.amount ?? ""}
                            onChange={(e) =>
                              updateRow(row.lineNumber, {
                                amount: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="0"
                            className="h-9 w-28 rounded-md border border-input bg-background pl-5 pr-2 text-sm font-semibold focus:border-primary focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.paidBy}
                          onChange={(e) => updateRow(row.lineNumber, { paidBy: e.target.value })}
                          className="h-9 min-w-[110px] rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.displayName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.paymentMethod}
                          onChange={(e) => updateRow(row.lineNumber, { paymentMethod: e.target.value })}
                          className="h-9 min-w-[100px] rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none"
                        >
                          {["UPI", "Cash", "Credit Card", "Bank Transfer"].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.lineNumber)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      {rows.length > 0 && (
        <div className="sticky bottom-4 z-10 sm:static">
          <Button
            onClick={handleSaveAll}
            disabled={saving || readyRows.length === 0}
            size="lg"
            className="w-full gap-2 text-base font-semibold shadow-xl sm:shadow-none"
          >
            {saving ? "Saving..." : `Save ${readyRows.length} Expense${readyRows.length === 1 ? "" : "s"} (${formatINR(totalAmount)})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function ScratchpadRowCard({
  row,
  categoryTree,
  members,
  onChange,
  onRemove,
}: {
  row: ResolvedScratchpadRow;
  categoryTree: CategoryWithChildren[];
  members: { id: string; displayName: string }[];
  onChange: (patch: Partial<ResolvedScratchpadRow>) => void;
  onRemove: () => void;
}) {
  const isComplete = Boolean(row.categoryId && row.paidBy && row.amount && row.amount > 0);

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border bg-surface p-3.5 shadow-sm transition-all",
        isComplete ? "border-border/80" : "border-amber-500/60 bg-amber-500/[0.03]"
      )}
    >
      <div className="flex items-center gap-2">
        <input
          value={row.itemName}
          onChange={(e) => onChange({ itemName: e.target.value })}
          placeholder="Item name"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
        />
        <div className="relative flex items-center">
          <span className="absolute left-2 text-xs font-semibold text-muted-foreground">₹</span>
          <input
            type="number"
            inputMode="decimal"
            value={row.amount ?? ""}
            onChange={(e) => onChange({ amount: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="0"
            className="min-h-10 w-24 rounded-lg border border-input bg-background pl-5 pr-2 text-right text-sm font-bold focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Remove row"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={row.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || null })}
          className={cn(
            "min-h-10 rounded-lg border bg-background px-2 text-xs font-medium focus:outline-none",
            row.categoryId ? "border-input text-foreground" : "border-amber-500/80 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          )}
        >
          <option value="">Category *</option>
          {categoryTree.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={row.paidBy}
          onChange={(e) => onChange({ paidBy: e.target.value })}
          className="min-h-10 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <select
          value={row.paymentMethod}
          onChange={(e) => onChange({ paymentMethod: e.target.value })}
          className="min-h-10 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none"
        >
          {["UPI", "Cash", "Credit Card", "Bank Transfer"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {row.merchantName && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Merchant:</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{row.merchantName}</span>
        </div>
      )}
    </div>
  );
}
