"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, NotebookPen, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseScratchpadText, resolveScratchpadLine, type ResolvedScratchpadRow } from "@/lib/scratchpad-parser";
import { getScratchpadDraft, saveScratchpadDraft, clearScratchpadDraft } from "@/lib/actions/scratchpad";
import { bulkCreateExpenses, type ScratchpadExpenseInput } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useMemo(
    () => [{ id: userId, displayName }, ...(partner ? [{ id: partner.id, displayName: partner.displayName }] : [])],
    [userId, displayName, partner]
  );

  useEffect(() => {
    Promise.all([getScratchpadDraft(), listCategoriesForHousehold(), listMerchantsForHousehold()]).then(([draft, cats, merch]) => {
      if (draft.data) setText(draft.data);
      if (cats.data) setCategoryTree(cats.data.tree);
      if (merch.data) setMerchants(merch.data);
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

  // Live "Parse & Review" table - re-parses at 0ms on every text change.
  useEffect(() => {
    const parsed = parseScratchpadText(text);
    setRows(parsed.map((p) => resolveScratchpadLine(p, categoryTree, merchants, members, userId)));
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
  const invalidCount = rows.length - readyRows.filter((r) => r.categoryId && r.paidBy).length;

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

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" prefetch={true} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <NotebookPen className="h-4.5 w-4.5" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Scratchpad</h1>
      </div>

      <p className="text-xs text-muted-foreground">
        Type one transaction per line, in any shorthand - amount, payment method, who paid, item. We&apos;ll parse it into a real expense below.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={6}
        className="max-h-[40dvh] min-h-32 resize-y overflow-y-auto font-mono text-sm"
      />

      {rows.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Parse &amp; Review ({rows.length})
            </h2>
            {invalidCount > 0 && <span className="text-[11px] text-amber-600 dark:text-amber-400">{invalidCount} row(s) need a category</span>}
          </div>

          {/* Mobile: stacked cards. sm+: a real table. Both read from the same `rows` state. */}
          <div className="space-y-2 sm:hidden">
            {rows.map((row) => (
              <ScratchpadRowCard key={row.lineNumber} row={row} categoryTree={categoryTree} members={members} onChange={(patch) => updateRow(row.lineNumber, patch)} onRemove={() => removeRow(row.lineNumber)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border/60 sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Merchant</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Paid By</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.lineNumber} className={cn("border-b border-border/40 last:border-0", (!row.categoryId || !row.paidBy) && "bg-amber-500/5")}>
                    <td className="px-3 py-1.5">
                      <input
                        value={row.itemName}
                        onChange={(e) => updateRow(row.lineNumber, { itemName: e.target.value })}
                        className="h-9 w-full min-w-[140px] rounded border border-transparent bg-transparent px-1.5 text-sm focus:border-input focus:bg-background focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.categoryId ?? ""}
                        onChange={(e) => {
                          const cat = categoryTree.find((c) => c.id === e.target.value);
                          updateRow(row.lineNumber, { categoryId: e.target.value || null, categoryName: cat?.name ?? null, subcategoryId: null, subcategoryName: null });
                        }}
                        className={cn("h-9 min-w-[130px] rounded border bg-surface px-1.5 text-sm", row.categoryId ? "border-input" : "border-amber-500/50")}
                      >
                        <option value="">Choose...</option>
                        {categoryTree.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{row.merchantName ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={row.amount ?? ""}
                        onChange={(e) => updateRow(row.lineNumber, { amount: e.target.value ? parseFloat(e.target.value) : null })}
                        className="h-9 w-24 rounded border border-transparent bg-transparent px-1.5 text-sm focus:border-input focus:bg-background focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.paidBy}
                        onChange={(e) => updateRow(row.lineNumber, { paidBy: e.target.value })}
                        className="h-9 min-w-[100px] rounded border border-input bg-surface px-1.5 text-sm"
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.paymentMethod}
                        onChange={(e) => updateRow(row.lineNumber, { paymentMethod: e.target.value })}
                        className="h-9 min-w-[110px] rounded border border-input bg-surface px-1.5 text-sm"
                      >
                        {["UPI", "Cash", "Credit Card", "Bank Transfer"].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <button type="button" onClick={() => removeRow(row.lineNumber)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove row">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky save bar, safe-area aware for iOS home indicator (spec: responsive hardening). */}
      {rows.length > 0 && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 sm:static sm:bottom-auto">
          <Button onClick={handleSaveAll} disabled={saving || readyRows.length === 0} className="min-h-11 w-full shadow-lg sm:shadow-none">
            {saving ? "Saving..." : `Save All to GharKharch (${readyRows.length})`}
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
  return (
    <div className={cn("space-y-2 rounded-xl border p-3", row.categoryId && row.paidBy ? "border-border/60" : "border-amber-500/50 bg-amber-500/5")}>
      <div className="flex items-center gap-2">
        <input
          value={row.itemName}
          onChange={(e) => onChange({ itemName: e.target.value })}
          className="min-h-11 min-w-0 flex-1 rounded border border-input bg-surface px-2 text-sm"
        />
        <input
          type="number"
          inputMode="decimal"
          value={row.amount ?? ""}
          onChange={(e) => onChange({ amount: e.target.value ? parseFloat(e.target.value) : null })}
          className="min-h-11 w-20 rounded border border-input bg-surface px-2 text-right text-sm font-semibold"
        />
        <button type="button" onClick={onRemove} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove row">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <select value={row.categoryId ?? ""} onChange={(e) => onChange({ categoryId: e.target.value || null })} className="min-h-11 rounded border border-input bg-surface px-1 text-xs">
          <option value="">Category</option>
          {categoryTree.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={row.paidBy} onChange={(e) => onChange({ paidBy: e.target.value })} className="min-h-11 rounded border border-input bg-surface px-1 text-xs">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <select value={row.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })} className="min-h-11 rounded border border-input bg-surface px-1 text-xs">
          {["UPI", "Cash", "Credit Card", "Bank Transfer"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
