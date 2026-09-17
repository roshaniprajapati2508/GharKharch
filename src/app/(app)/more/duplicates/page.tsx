"use client";

// "Find duplicates" tool (spec items 39, 45-46, 80) — surfaces potential
// duplicate categories/merchants the household created themselves (the
// global-category seeding bug already has its own one-time SQL cleanup in
// migration 011) and lets the user merge them, with the affected-expense
// count shown before they commit. Never auto-merges — spec item 80 is
// explicit that ambiguous records stay separate until a person confirms.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Merge, Loader2, Tag, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  findDuplicateCategories,
  findDuplicateMerchants,
  getCategoryMergeImpact,
  getMerchantMergeImpact,
  mergeCategories,
  mergeMerchants,
  type DuplicateGroup,
} from "@/lib/actions/duplicates";

type Kind = "category" | "merchant";

interface MergeTarget {
  kind: Kind;
  group: DuplicateGroup;
}

export default function FindDuplicatesPage() {
  const [categoryGroups, setCategoryGroups] = useState<DuplicateGroup[]>([]);
  const [merchantGroups, setMerchantGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<MergeTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, merchs] = await Promise.all([findDuplicateCategories(), findDuplicateMerchants()]);
    if (cats.data) setCategoryGroups(cats.data);
    if (merchs.data) setMerchantGroups(merchs.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, [load]);

  const totalGroups = categoryGroups.length + merchantGroups.length;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex items-center gap-3">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Find duplicates</h1>
          <p className="text-xs text-muted-foreground">Merge categories or merchants you accidentally created twice.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : totalGroups === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Merge className="h-8 w-8 text-brand-primary" />
            <p className="font-medium text-foreground">No duplicates found</p>
            <p className="text-sm text-muted-foreground">Your categories and merchants all look distinct.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {categoryGroups.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Tag className="h-4 w-4 text-brand-primary" />
                Categories
              </h2>
              {categoryGroups.map((group) => (
                <DuplicateGroupCard key={group.nameKey} group={group} onMerge={() => setTarget({ kind: "category", group })} />
              ))}
            </section>
          )}

          {merchantGroups.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Store className="h-4 w-4 text-brand-primary" />
                Merchants
              </h2>
              {merchantGroups.map((group) => (
                <DuplicateGroupCard key={group.nameKey} group={group} onMerge={() => setTarget({ kind: "merchant", group })} />
              ))}
            </section>
          )}
        </div>
      )}

      {target && (
        <MergeDialog
          target={target}
          onOpenChange={(open) => !open && setTarget(null)}
          onMerged={() => {
            setTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DuplicateGroupCard({ group, onMerge }: { group: DuplicateGroup; onMerge: () => void }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
          {group.names.map((name, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              {name}
              {group.isGlobal[i] && <span className="text-[10px] text-muted-foreground">(default)</span>}
            </span>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={onMerge}>
          <Merge className="h-3.5 w-3.5" />
          Merge
        </Button>
      </CardContent>
    </Card>
  );
}

function MergeDialog({ target, onOpenChange, onMerged }: { target: MergeTarget; onOpenChange: (open: boolean) => void; onMerged: () => void }) {
  const { kind, group } = target;
  // A global/system entry can never be the side a merge deletes (enforced server-side
  // in merge_categories/merge_merchants), so when one is in the group it's the only
  // valid "keep" choice — pin the selection to it and don't offer the others at all,
  // instead of letting the person pick wrong and hit a confusing error (migration 013).
  const globalIndex = group.isGlobal.findIndex(Boolean);
  const hasGlobal = globalIndex !== -1;
  const [canonicalId, setCanonicalId] = useState(hasGlobal ? group.ids[globalIndex] : group.ids[0]);
  const [impact, setImpact] = useState<{ expenseCount: number; otherCount: number } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [merging, setMerging] = useState(false);

  const duplicateIds = group.ids.filter((id) => id !== canonicalId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off a fetch triggered by canonicalId changing, not derivable from render
    setLoadingImpact(true);
    const getImpact = kind === "category" ? getCategoryMergeImpact : getMerchantMergeImpact;
    Promise.all(duplicateIds.map((id) => getImpact(id))).then((results) => {
      const totals = results.reduce(
        (acc, r) => ({
          expenseCount: acc.expenseCount + (r.data?.expenseCount ?? 0),
          otherCount: acc.otherCount + (r.data?.otherCount ?? 0),
        }),
        { expenseCount: 0, otherCount: 0 }
      );
      setImpact(totals);
      setLoadingImpact(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- duplicateIds is derived from canonicalId each render, re-running on canonicalId alone is correct
  }, [canonicalId, kind]);

  async function handleMerge() {
    setMerging(true);
    const mergeFn = kind === "category" ? mergeCategories : mergeMerchants;
    let totalReassigned = 0;
    for (const dupId of duplicateIds) {
      const result = await mergeFn(canonicalId, dupId);
      if (result.error) {
        toast.error(`Couldn't merge "${group.names[group.ids.indexOf(dupId)]}"`, { description: result.error });
        setMerging(false);
        return;
      }
      totalReassigned += result.data?.expensesReassigned ?? 0;
    }
    toast.success("Categories merged", { description: `${totalReassigned} expense${totalReassigned === 1 ? "" : "s"} preserved` });
    setMerging(false);
    onMerged();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {kind === "category" ? "categories" : "merchants"}</DialogTitle>
          <DialogDescription>Choose which one to keep — the others will be combined into it.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={canonicalId} onValueChange={setCanonicalId} className="gap-3">
          {group.ids.map((id, i) => {
            const isGlobalEntry = group.isGlobal[i];
            const disabled = hasGlobal && !isGlobalEntry;
            return (
              <div key={id} className={cn("flex items-center gap-2.5 rounded-lg border border-border p-3", disabled && "opacity-50")}>
                <RadioGroupItem value={id} id={id} disabled={disabled} />
                <Label htmlFor={id} className={cn("flex flex-1 items-center gap-2 text-sm font-medium", disabled ? "cursor-default" : "cursor-pointer")}>
                  {group.names[i]}
                  {isGlobalEntry && (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                      Global default
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {hasGlobal && (
          <p className="text-xs text-muted-foreground">
            The global default is always the one kept — the other{group.ids.length > 2 ? "s" : ""} will be merged into it.
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {loadingImpact ? (
            "Checking affected expenses…"
          ) : (
            <>
              Affected expenses: <span className="font-medium text-foreground">{impact?.expenseCount ?? 0}</span>
              {impact && impact.otherCount > 0 && ` · ${impact.otherCount} other reference${impact.otherCount === 1 ? "" : "s"}`}
            </>
          )}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button onClick={handleMerge} loading={merging} disabled={loadingImpact}>
            Merge {group.ids.length > 1 ? `${group.ids.length} entries` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
