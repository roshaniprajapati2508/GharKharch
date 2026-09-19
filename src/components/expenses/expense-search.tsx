"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  X,
  Search as SearchIcon,
  Clock,
  Sparkles,
  PieChart,
  Target,
  Repeat,
  Tag,
  ArrowRight,
  Receipt,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ExpenseList } from "@/components/expenses/expense-list";
import { useHousehold } from "@/lib/context/household-context";
import { createClient } from "@/lib/supabase/client";
import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import { getClientCachedData, setClientCachedData } from "@/lib/cache/client-cache";
import type { EnrichedExpense } from "@/lib/actions/expenses";
import { parseQuickEntry } from "@/lib/expense-intelligence/nl-parser";
import { useAddExpense } from "@/lib/context/add-expense-context";

const RECENT_KEY = "gharkharch:recent-searches";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  if (typeof window === "undefined" || !query || typeof query !== "string" || !query.trim()) return;
  const clean = query.trim();
  const recent = [clean, ...loadRecent().filter((q) => typeof q === "string" && q.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function clearAllRecent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RECENT_KEY);
}

type CategoryLite = { id: string; name: string; icon: string | null; color: string | null; parent_id: string | null };
type MerchantLite = { id: string; name: string };

function parseSearchIntent(
  query: string,
  partnerName: string | undefined,
  categories: CategoryLite[],
  merchants: MerchantLite[]
) {
  const trimmed = (typeof query === "string" ? query : "").trim();
  if (!trimmed) return { type: "empty" as const, label: "" };

  const amountMatch = trimmed.match(/^([<>]=?)\s*(\d+(\.\d+)?)$/);
  if (amountMatch) {
    const op = amountMatch[1];
    const val = parseFloat(amountMatch[2]);
    return {
      type: "amount" as const,
      op,
      value: val,
      label: `Amount ${op} ${formatINR(val)}`,
    };
  }

  const lower = trimmed.toLowerCase();
  if (["me", "myself"].includes(lower)) {
    return { type: "person" as const, who: "me", label: "Paid by You" };
  }
  if (["wife", "husband", "partner", (partnerName ?? "").toLowerCase()].filter(Boolean).includes(lower)) {
    return { type: "person" as const, who: "partner", label: `Paid by ${partnerName || "Partner"}` };
  }

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const monthIndex = months.indexOf(lower);
  if (monthIndex >= 0) {
    return {
      type: "month" as const,
      monthIndex,
      label: `Month: ${months[monthIndex].charAt(0).toUpperCase() + months[monthIndex].slice(1)}`,
    };
  }

  if (lower.length >= 2) {
    const matchedCategory = categories.find((c) => c.name.toLowerCase() === lower || c.name.toLowerCase().includes(lower));
    if (matchedCategory) {
      const categoryIds = [
        matchedCategory.id,
        ...categories.filter((c) => c.parent_id === matchedCategory.id).map((c) => c.id),
      ];
      return {
        type: "category" as const,
        categoryIds,
        categoryName: matchedCategory.name,
        label: `Category: ${matchedCategory.name}`,
      };
    }

    const matchedMerchants = merchants.filter((m) => m.name.toLowerCase().includes(lower));
    if (matchedMerchants.length > 0) {
      return {
        type: "merchant" as const,
        merchantIds: matchedMerchants.map((m) => m.id),
        text: trimmed,
        label: `Merchant: ${matchedMerchants[0].name}`,
      };
    }
  }

  return { type: "text" as const, text: trimmed, label: `Search: "${trimmed}"` };
}

interface ExpenseSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (expense: EnrichedExpense) => void;
  onDuplicate?: (expense: EnrichedExpense) => void;
  onDelete?: (expense: EnrichedExpense) => void;
}

export function ExpenseSearch({
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
}: ExpenseSearchProps) {
  const { householdId, userId, partner } = useHousehold();
  const { openAdd, openShopping } = useAddExpense();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EnrichedExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>(() => getClientCachedData<CategoryLite[]>("search_categories") || []);
  const [merchants, setMerchants] = useState<MerchantLite[]>(() => getClientCachedData<MerchantLite[]>("search_merchants") || []);
  const [recentExpenses, setRecentExpenses] = useState<EnrichedExpense[]>(() => getClientCachedData<EnrichedExpense[]>("expenses_list") || []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      const cachedList = getClientCachedData<EnrichedExpense[]>("expenses_list");
      if (cachedList && cachedList.length > 0) {
        setRecentExpenses(cachedList.slice(0, 10));
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !householdId) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("categories").select("id, name, icon, color, parent_id"),
      supabase.from("merchants").select("id, name"),
    ]).then(([{ data: cats }, { data: merch }]) => {
      if (cats) {
        setCategories(cats);
        setClientCachedData("search_categories", cats);
      }
      if (merch) {
        setMerchants(merch);
        setClientCachedData("search_merchants", merch);
      }
    });
  }, [open, householdId]);

  const intent = useMemo(
    () => parseSearchIntent(query, partner?.displayName, categories, merchants),
    [query, partner, categories, merchants]
  );

  // Direct NL execution (spec: Pillar 2). Typing something that reads like a
  // quick add - "Petrol 500 upi", "Milk 60" - rather than a search, offers to
  // open the Add Expense sheet pre-filled instead of only filtering results.
  // Only surfaced when the text didn't already resolve to a more specific
  // search intent (category/merchant/person/month/amount-comparison), and
  // needs both a plausible item name and a parsed amount to avoid firing on
  // an ordinary search term that happens to contain a number.
  const quickEntry = useMemo(() => {
    const trimmed = (typeof query === "string" ? query : "").trim();
    if (trimmed.length < 4 || intent.type !== "text") return null;
    const parsed = parseQuickEntry(trimmed);
    if (parsed.amount === null || !parsed.itemName || !parsed.itemName.trim()) return null;
    return parsed;
  }, [query, intent]);

  function handleQuickEntryAdd() {
    saveRecent(query);
    onOpenChange(false);
    openAdd(query.trim());
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
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
          recurring_rule_name: null,
        };
      });

      if (!cancelled) {
        setResults(enriched);
        setLoading(false);
      }
    }

    const timeout = setTimeout(run, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, intent, householdId, userId, partner, categories, merchants]);

  function handleSelectSearch(term: string) {
    setQuery(term);
    saveRecent(term);
    setRecent(loadRecent());
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  const popularCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parent_id)
      .slice(0, 7);
  }, [categories]);

  const searchTotalAmount = useMemo(() => {
    return results.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-0 h-dvh max-h-dvh w-screen max-w-none translate-y-0 rounded-none p-0 sm:top-1/2 sm:h-auto sm:max-h-[85dvh] sm:w-[92vw] sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:shadow-2xl overflow-hidden flex flex-col bg-background"
      >
        <DialogTitle className="sr-only">Command Search Expenses</DialogTitle>

        {/* Command Palette Top Input Bar */}
        <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur-md p-3 sm:p-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-surface px-3 py-1.5 shadow-2xs focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <SearchIcon className="h-4 w-4" />
            </div>

            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  saveRecent(query);
                  setRecent(loadRecent());
                }
              }}
              placeholder="Search expenses, merchants, categories..."
              className="h-9 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70"
            />

            {query.trim() && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="hidden sm:inline-flex items-center rounded border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
            >
              ESC
            </button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="sm:hidden flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Category Chips Bar */}
          {popularCategories.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground flex items-center gap-1 mr-0.5">
                <Tag className="h-3 w-3" /> Quick:
              </span>
              {popularCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectSearch(cat.name)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-3.5 w-3.5 items-center justify-center rounded" />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Command Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Direct NL Execution: looks like a quick-add, not a search */}
          {quickEntry && (
            <button
              type="button"
              onClick={handleQuickEntryAdd}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-brand-primary/30 bg-gradient-to-r from-brand-primary/10 to-emerald-500/5 px-3.5 py-2.5 text-left hover:border-brand-primary/50 hover:bg-brand-primary/15 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Plus className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                Add <strong>&quot;{quickEntry.itemName}&quot;</strong>
                {" "}&middot; {formatINR(quickEntry.amount ?? 0)}
                {quickEntry.paymentMethod ? ` · ${quickEntry.paymentMethod}` : ""}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-brand-primary" />
            </button>
          )}

          {/* Active Search Intent Indicator */}
          {query.trim() && intent.type !== "text" && intent.type !== "empty" && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Smart filter active: <strong>{intent.label}</strong></span>
            </div>
          )}

          {/* Results Summary Header */}
          {query.trim() && !loading && results.length > 0 && (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{results.length} expense{results.length === 1 ? "" : "s"} found</span>
              <span className="font-semibold text-foreground">Total: {formatINR(searchTotalAmount)}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex flex-col gap-2 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          )}

          {/* Query Results List */}
          {query.trim() && !loading && results.length > 0 && (
            <ExpenseList
              expenses={results}
              onEdit={(e) => {
                onOpenChange(false);
                onEdit?.(e);
              }}
              onDuplicate={(e) => {
                onOpenChange(false);
                onDuplicate?.(e);
              }}
              onDelete={onDelete ?? (() => {})}
            />
          )}

          {/* No Results Empty State */}
          {query.trim() && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                <SearchIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No expenses match &quot;{query}&quot;</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Try searching by merchant name (e.g. Zomato, Swiggy), category (Groceries, Fuel), or amount (&gt;1000).
              </p>
              <button
                type="button"
                onClick={handleClear}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Default / Empty Query View */}
          {!query.trim() && (
            <div className="space-y-5">
              {/* Recent Searches Section */}
              {recent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Recent searches
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearAllRecent();
                        setRecent([]);
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => handleSelectSearch(r)}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      >
                        <SearchIcon className="h-3 w-3 opacity-60" />
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions / Command Shortcuts */}
              <div className="space-y-2">
                <p className="px-1 text-xs font-semibold text-muted-foreground">Quick Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openAdd();
                    }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/50 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Add New Expense</p>
                        <p className="text-[10px] text-muted-foreground">Or just type it above (e.g. &quot;Milk 60&quot;)</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openShopping();
                    }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/50 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Shopping Mode</p>
                        <p className="text-[10px] text-muted-foreground">Add several items in one go</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <Link
                    href="/more/ask"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-3 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Ask GharKharch AI</p>
                        <p className="text-[10px] text-muted-foreground">Natural language insights</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href="/analytics"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <PieChart className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Analytics & Heatmaps</p>
                        <p className="text-[10px] text-muted-foreground">Category breakdown & trends</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href="/more/budgets"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Target className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Monthly Budgets</p>
                        <p className="text-[10px] text-muted-foreground">Manage category limits</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href="/more/recurring"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Repeat className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Recurring Payments</p>
                        <p className="text-[10px] text-muted-foreground">Subscriptions & EMIs</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Recent Transactions List (Instant Render) */}
              {recentExpenses.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" /> Recent Transactions
                    </p>
                    <span className="text-[11px] text-muted-foreground">Tap to view/edit</span>
                  </div>
                  <ExpenseList
                    expenses={recentExpenses}
                    onEdit={(e) => {
                      onOpenChange(false);
                      onEdit?.(e);
                    }}
                    onDuplicate={(e) => {
                      onOpenChange(false);
                      onDuplicate?.(e);
                    }}
                    onDelete={onDelete ?? (() => {})}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
