"use client";

import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayRange, getLast7DaysRange, getLast30DaysRange, getMonthRange, getPreviousMonthRange } from "@/lib/date-utils";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { ExpenseFilters } from "@/lib/actions/expenses";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import type { Tables } from "@/types/database";

const QUICK_RANGES = [
  { key: "today", label: "Today", get: getTodayRange },
  { key: "7d", label: "7D", get: getLast7DaysRange },
  { key: "30d", label: "30D", get: getLast30DaysRange },
  { key: "month", label: "This Month", get: () => getMonthRange(0) },
  { key: "lastMonth", label: "Last Month", get: getPreviousMonthRange },
  { key: "all", label: "All Time (બધો સમય)", get: () => ({ start: undefined, end: undefined }) },
] as const;

export interface AppliedFilters extends ExpenseFilters {
  rangeKey?: string;
}

export function ExpenseFiltersSheet({
  open,
  onOpenChange,
  categories,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryWithChildren[];
  filters: AppliedFilters;
  onApply: (filters: AppliedFilters) => void;
}) {
  const { userId, partner } = useHousehold();
  const [draft, setDraft] = useState<AppliedFilters>(filters);
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>([]);

  useEffect(() => {
    if (!open) return;
    listMerchantsForHousehold().then((result) => {
      if (result.data) setMerchants(result.data);
    });
  }, [open]);

  function toggleCategory(id: string) {
    const current = draft.categoryIds ?? [];
    setDraft({ ...draft, categoryIds: current.includes(id) ? current.filter((c) => c !== id) : [...current, id] });
  }

  function toggleMerchant(id: string) {
    const current = draft.merchantIds ?? [];
    setDraft({ ...draft, merchantIds: current.includes(id) ? current.filter((m) => m !== id) : [...current, id] });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>Filter expenses</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="flex flex-col gap-5">
            <div>
              <Label>Period</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setDraft({ ...draft, rangeKey: r.key, ...r.get() })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm font-medium",
                      draft.rangeKey === r.key ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={draft.start ?? ""}
                  onChange={(e) => setDraft({ ...draft, rangeKey: "custom", start: e.target.value })}
                />
                <Input
                  type="date"
                  value={draft.end ?? ""}
                  onChange={(e) => setDraft({ ...draft, rangeKey: "custom", end: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Type</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "expense", label: "Spend only" },
                  { value: "income", label: "Incoming only" },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, entryType: t.value as ExpenseFilters["entryType"] })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm font-medium",
                      (draft.entryType ?? "all") === t.value
                        ? "border-primary bg-secondary text-secondary-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Who paid / received</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "all", label: "Household" },
                  { id: userId, label: "Me" },
                  ...(partner ? [{ id: partner.id, label: partner.displayName }] : []),
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, paidBy: p.id as ExpenseFilters["paidBy"] })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm font-medium",
                      (draft.paidBy ?? "all") === p.id ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Categories</Label>
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm">
                    <Checkbox checked={(draft.categoryIds ?? []).includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Merchants</Label>
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {merchants.length === 0 ? (
                  <p className="px-1.5 py-1.5 text-xs text-muted-foreground">No merchants yet</p>
                ) : (
                  merchants.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm">
                      <Checkbox checked={(draft.merchantIds ?? []).includes(m.id)} onCheckedChange={() => toggleMerchant(m.id)} />
                      {m.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <Label>Amount range</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Min ₹"
                  value={draft.minAmount ?? ""}
                  onChange={(e) => setDraft({ ...draft, minAmount: e.target.value ? Number(e.target.value) : undefined })}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Max ₹"
                  value={draft.maxAmount ?? ""}
                  onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div>
              <Label>Sort by</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "highest", label: "Highest amount" },
                  { value: "lowest", label: "Lowest amount" },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, sort: s.value as ExpenseFilters["sort"] })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm font-medium",
                      (draft.sort ?? "newest") === s.value ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              const cleared: AppliedFilters = {};
              setDraft(cleared);
              onApply(cleared);
              onOpenChange(false);
            }}
          >
            Clear all
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply filters
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
