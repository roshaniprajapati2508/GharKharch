"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search as SearchIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ExpenseList } from "@/components/expenses/expense-list";
import { useHousehold } from "@/lib/context/household-context";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedExpense } from "@/lib/actions/expenses";

const RECENT_KEY = "gharkharch:recent-searches";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  if (typeof window === "undefined") return;
  const recent = [query, ...loadRecent().filter((q) => q !== query)].slice(0, 5);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

type CategoryLite = { id: string; name: string; parent_id: string | null };
type MerchantLite = { id: string; name: string };

/**
 * Parses a small set of operators from spec section 20's examples: ">5000",
 * "wife", "september", a category/subcategory name, a merchant name, or a
 * plain text search. Category/merchant matching is partial and case
 * insensitive against the already-fetched lists (no extra round trip) — a
 * parent category match also pulls in all of its subcategory ids.
 */
function parseSearchIntent(query: string, partnerName: string | undefined, categories: CategoryLite[], merchants: MerchantLite[]) {
  const trimmed = query.trim();
  const amountMatch = trimmed.match(/^([<>]=?)\s*(\d+(\.\d+)?)$/);
  if (amountMatch) {
    return { type: "amount" as const, op: amountMatch[1], value: parseFloat(amountMatch[2]) };
  }
  const lower = trimmed.toLowerCase();
  if (["me", "myself"].includes(lower)) return { type: "person" as const, who: "me" };
  if (["wife", "husband", "partner", (partnerName ?? "").toLowerCase()].filter(Boolean).includes(lower)) {
    return { type: "person" as const, who: "partner" };
  }
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const monthIndex = months.indexOf(lower);
  if (monthIndex >= 0) return { type: "month" as const, monthIndex };

  if (lower.length >= 2) {
    const matchedCategory = categories.find((c) => c.name.toLowerCase().includes(lower));
    if (matchedCategory) {
      const categoryIds = [matchedCategory.id, ...categories.filter((c) => c.parent_id === matchedCategory.id).map((c) => c.id)];
      return { type: "category" as const, categoryIds };
    }

    const matchedMerchants = merchants.filter((m) => m.name.toLowerCase().includes(lower));
    if (matchedMerchants.length > 0) {
      return { type: "merchant" as const, merchantIds: matchedMerchants.map((m) => m.id), text: trimmed };
    }
  }

  return { type: "text" as const, text: trimmed };
}

export function ExpenseSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { householdId, userId, partner } = useHousehold();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EnrichedExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null; color: string | null; parent_id: string | null }[]>([]);
  const [merchants, setMerchants] = useState<MerchantLite[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing recent searches when the sheet opens
    if (open) setRecent(loadRecent());
  }, [open]);

  // Categories/merchants are fetched once (up front, not per-keystroke) and reused both for
  // parsing the search intent (category/merchant name matching) and for result enrichment below.
  useEffect(() => {
    if (!open || !householdId) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("categories").select("id, name, icon, color, parent_id"),
      supabase.from("merchants").select("id, name"),
    ]).then(([{ data: cats }, { data: merch }]) => {
      setCategories(cats ?? []);
      setMerchants(merch ?? []);
    });
  }, [open, householdId]);

  const intent = useMemo(() => parseSearchIntent(query, partner?.displayName, categories, merchants), [query, partner, categories, merchants]);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query is emptied
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();

    async function run() {
      let q = supabase.from("expenses").select("*").eq("household_id", householdId).is("deleted_at", null);

      if (intent.type === "amount") {
        q = intent.op.startsWith(">") ? q.gt("amount", intent.value) : q.lt("amount", intent.value);
      } else if (intent.type === "person") {
        q = q.eq("paid_by", intent.who === "me" ? userId : partner?.id ?? userId);
      } else if (intent.type === "month") {
        const year = new Date().getFullYear();
        const start = `${year}-${String(intent.monthIndex + 1).padStart(2, "0")}-01`;
        const end = new Date(year, intent.monthIndex + 1, 0).toISOString().slice(0, 10);
        q = q.gte("expense_date", start).lte("expense_date", end);
      } else if (intent.type === "category") {
        q = q.in("category_id", intent.categoryIds);
      } else if (intent.type === "merchant") {
        // Merchant id match, OR'd with the existing text fallback so "Zomato" still finds
        // expenses at that merchant even when item_name/notes don't literally contain it.
        const merchantFilter = intent.merchantIds.map((id) => `merchant_id.eq.${id}`).join(",");
        q = q.or(`${merchantFilter},item_name.ilike.%${intent.text}%,notes.ilike.%${intent.text}%`);
      } else {
        q = q.or(`item_name.ilike.%${intent.text}%,notes.ilike.%${intent.text}%`);
      }

      const { data } = await q.order("expense_date", { ascending: false }).limit(50);
      if (cancelled) return;

      const { data: profiles } = await supabase.from("profiles").select("id, display_name");
      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

      const enriched: EnrichedExpense[] = (data ?? []).map((e) => {
        const cat = categoryMap.get(e.category_id);
        const subcat = e.subcategory_id ? categoryMap.get(e.subcategory_id) : null;
        return {
          ...e,
          category_name: cat?.name ?? null,
          category_icon: cat?.icon ?? null,
          category_color: cat?.color ?? null,
          subcategory_name: subcat?.name ?? null,
          merchant_name: e.merchant_id ? merchantMap.get(e.merchant_id) ?? null : null,
          payer_name: profileMap.get(e.paid_by) ?? "Someone",
        };
      });

      if (!cancelled) {
        setResults(enriched);
        setLoading(false);
      }
    }

    const timeout = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, intent, householdId, userId, partner, categories, merchants]);

  function handleSubmit() {
    if (query.trim()) saveRecent(query.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-0 h-dvh max-h-dvh w-screen max-w-none translate-y-0 rounded-none p-0 sm:top-1/2 sm:h-auto sm:max-h-[85vh] sm:w-[92vw] sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl"
      >
        <DialogTitle className="sr-only">Search expenses</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search item, merchant, category, >5000, wife, September…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="h-9 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <button onClick={() => onOpenChange(false)} aria-label="Close search" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {!query.trim() && recent.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent searches</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses match &quot;{query}&quot;.</p>
          )}

          {results.length > 0 && (
            <ExpenseList expenses={results} onEdit={() => {}} onDuplicate={() => {}} onDelete={() => {}} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
