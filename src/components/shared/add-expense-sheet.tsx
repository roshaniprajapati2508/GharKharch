"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Store,
  Sparkles,
  Paperclip,
  ScanLine,
  Loader2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark,
  Layers,
  Plus,
  Trash2,
  ShoppingCart,
  Zap,
  Check,
  Calendar,
  Mic,
  MicOff,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/expenses/amount-input";
import { CategoryPicker, type CategorySelection } from "@/components/expenses/category-picker";
import { MerchantPicker } from "@/components/expenses/merchant-picker";
import { PaidBySelector, ExpenseTypeSelector } from "@/components/expenses/person-selector";
import { CardQuickPicker, UpiQuickPicker, BankQuickPicker } from "@/components/expenses/payment-method-select";
import { QuickAddBar } from "@/components/shared/quick-add-bar";
import { getIcon, colorSwatch } from "@/lib/icon-map";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO, addDaysISO } from "@/lib/date-utils";
import { createExpense, updateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { listPaymentMethodsForHousehold } from "@/lib/actions/payment-methods";
import { listUserCards, listUpiProfiles, listBankAccounts, type EnrichedUserCard } from "@/lib/actions/payment-instruments";
import { DEFAULT_HOUSEHOLD_CARDS } from "@/lib/constants/payment-cards";
import { getQuickAddChips, type QuickAddChip } from "@/lib/actions/quick-add";
import { getCategorySuggestion, getPastExpensePredictions, type PastExpensePrediction } from "@/lib/actions/intelligence";
import { getItemPriceMemory, type ItemPriceMemory } from "@/lib/actions/insights";
import type { CategorySuggestion } from "@/lib/expense-intelligence/category-suggester";
import { suggestMerchant } from "@/lib/expense-intelligence/merchant-suggester";
import { isOffline, isNetworkError, queueExpense } from "@/lib/offline/offline-queue";
import { useOffline } from "@/lib/context/offline-context";
import { parseQuickEntry } from "@/lib/expense-intelligence/nl-parser";
import { matchKeywordRule } from "@/lib/expense-intelligence/keyword-map";
import { fuzzyMatches } from "@/lib/expense-intelligence/fuzzy-match";
import { timeOfDayCategoryBoost } from "@/lib/expense-intelligence/time-of-day";
import { detectPriceChange, type PriceChangeFlag } from "@/lib/actions/insights";
import { ReceiptReviewSheet, type ReceiptReviewValues } from "@/components/shared/receipt-review-sheet";
import { checkAiConfigured, scanReceipt } from "@/lib/actions/receipts";
import type { ParsedReceipt } from "@/lib/ai/receipt-parser";
import { createClient } from "@/lib/supabase/client";
import { getClientCachedData, setClientCachedData } from "@/lib/cache/client-cache";
import type { Tables, ExpenseType } from "@/types/database";
import { cn, formatINR } from "@/lib/utils";

interface AddExpenseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: EnrichedExpense | null;
  duplicateFrom?: EnrichedExpense | null;
  onOptimisticAdd?: (expense: Tables<"expenses">) => void;
  onSaved?: (expense: Tables<"expenses">) => void;
  onOpenShoppingMode?: () => void;
  initialMode?: "single" | "shopping";
  /**
   * Free-text quick entry to parse and pre-fill on open (spec: Pillar 2,
   * command-palette "direct NL execution" - e.g. typing "Petrol 500 UPI" into
   * Cmd+K opens this sheet already filled in via parseQuickEntry()). Only
   * applied once per sheet-open, and only for a fresh add (never overrides
   * editExpense/duplicateFrom). Still requires the normal Save tap - this is
   * a pre-fill, not an auto-save, consistent with this app's review-before-
   * apply rule for anything parsed automatically.
   */
  initialQuickEntry?: string | null;
}

interface ShoppingRow {
  key: string;
  itemName: string;
  amount: string;
  category: CategorySelection | null;
}

function emptyShoppingRow(carryOver: CategorySelection | null): ShoppingRow {
  return { key: crypto.randomUUID(), itemName: "", amount: "", category: carryOver };
}

function getCurrentISTTime(): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

function emptySingleState(userId: string) {
  return {
    amount: "",
    itemName: "",
    merchant: null as Tables<"merchants"> | null,
    category: null as CategorySelection | null,
    paidBy: userId,
    expenseType: "household" as ExpenseType,
    date: getTodayISO(),
    time: getCurrentISTTime(),
    paymentMethod: "UPI" as string | null, // Default to UPI as requested
    cardId: null as string | null,
    upiProfileId: null as string | null,
    bankAccountId: null as string | null,
    notes: "",
    entryType: "expense" as "expense" | "income",
  };
}

const COMMON_PAYMENT_METHODS = [
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "Credit Card", label: "Credit Card", icon: CreditCard },
  { id: "Debit Card", label: "Debit Card", icon: CreditCard },
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "Bank Transfer", label: "Bank", icon: Landmark },
];

/** Pre-seeded instant top categories (0ms fallback before or during network cache hydration) */
const DEFAULT_TOP_CATEGORIES: CategoryWithChildren[] = [
  { id: "seed-food", name: "Food & Grocery", icon: "shopping-basket", color: "green", sort_order: 10, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-shopping", name: "Shopping", icon: "shopping-bag", color: "pink", sort_order: 20, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-fashion", name: "Fashion", icon: "shirt", color: "purple", sort_order: 30, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-household", name: "Household", icon: "home", color: "amber", sort_order: 50, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-transport", name: "Transport", icon: "car", color: "orange", sort_order: 60, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-health", name: "Health", icon: "heart-pulse", color: "red", sort_order: 70, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-personal", name: "Personal", icon: "user", color: "teal", sort_order: 80, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
];

const DEFAULT_PRESEEDED_CARDS: EnrichedUserCard[] = DEFAULT_HOUSEHOLD_CARDS.map((c, idx) => ({
  id: `preseeded-${idx}`,
  household_id: "",
  user_id: "",
  custom_name: c.custom_name,
  issuer_id: null,
  issuer_name: c.issuer_name,
  card_product_id: null,
  last4: null,
  network: null,
  card_type: c.card_type,
  credit_limit: null,
  statement_day: null,
  due_day: null,
  color: null,
  is_active: true,
  created_at: "",
  updated_at: "",
}));

export function AddExpenseSheet({
  open,
  onOpenChange,
  editExpense,
  duplicateFrom,
  initialQuickEntry,
  onOptimisticAdd,
  onSaved,
  initialMode = "single",
}: AddExpenseSheetProps) {
  const { userId, householdId } = useHousehold();
  const { refreshPendingCount } = useOffline();
  const isEditing = !!editExpense;
  const isNewExpense = !isEditing && !duplicateFrom;

  // Active Tab Mode: 'single' | 'shopping'
  const [entryMode, setEntryMode] = useState<"single" | "shopping">(initialMode);

  // Single mode state
  const [form, setForm] = useState(() => emptySingleState(userId));
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Shopping mode state
  const [shoppingRows, setShoppingRows] = useState<ShoppingRow[]>([emptyShoppingRow(null)]);
  const [shoppingCategoryRowKey, setShoppingCategoryRowKey] = useState<string | null>(null);

  // Reference data with instant client caching & 0ms instant fallback
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>(() => {
    const cached = getClientCachedData<CategoryWithChildren[]>("categories_tree_active");
    return cached && cached.length > 0 ? cached : DEFAULT_TOP_CATEGORIES;
  });
  const [categoryFlat, setCategoryFlat] = useState<Tables<"categories">[]>(() => {
    return getClientCachedData<Tables<"categories">[]>("categories_flat_budget") ?? [];
  });
  // Expense and income categories are disjoint (categories.type, migration
  // 023) - the picker must only ever offer the set matching the current
  // Expense/Income toggle, or someone logging a sale could pick "Petrol".
  const expenseCategoryTree = useMemo(() => categoryTree.filter((c) => c.type !== "income"), [categoryTree]);
  const incomeCategoryTree = useMemo(() => categoryTree.filter((c) => c.type === "income"), [categoryTree]);
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>(
    () => getClientCachedData<Tables<"merchants">[]>("merchants_list") ?? []
  );
  const [paymentMethods, setPaymentMethods] = useState<Tables<"payment_methods">[]>(
    () => getClientCachedData<Tables<"payment_methods">[]>("payment_methods_active") ?? []
  );
  const [cards, setCards] = useState<EnrichedUserCard[]>(
    () => getClientCachedData<EnrichedUserCard[]>("user_cards_list") ?? DEFAULT_PRESEEDED_CARDS
  );
  const [upiProfiles, setUpiProfiles] = useState<Tables<"upi_profiles">[]>(
    () => getClientCachedData<Tables<"upi_profiles">[]>("upi_profiles_list") ?? []
  );
  const [bankAccounts, setBankAccounts] = useState<Tables<"bank_accounts">[]>(
    () => getClientCachedData<Tables<"bank_accounts">[]>("bank_accounts_list") ?? []
  );
  const [quickAddChips, setQuickAddChips] = useState<QuickAddChip[]>(
    () => getClientCachedData<QuickAddChip[]>("quick_add_chips") ?? []
  );
  const [pastPredictions, setPastPredictions] = useState<PastExpensePrediction[]>(
    () => getClientCachedData<PastExpensePrediction[]>("past_expense_predictions") ?? []
  );
  // True while the background refresh below is still in flight - lets the
  // merchant picker show "Loading your merchants..." instead of a false
  // "No merchants match" if it's opened before this first fetch resolves
  // (e.g. tapping "+ Add" then immediately tapping the merchant field).
  const [refsLoading, setRefsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    setEntryMode(initialMode);
    setShoppingRows([emptyShoppingRow(null)]);
    setRefsLoading(true);

    // Refresh refs in background
    Promise.all([
      listCategoriesForHousehold(),
      listMerchantsForHousehold(),
      listPaymentMethodsForHousehold(),
      listUserCards(),
      listUpiProfiles(),
      listBankAccounts(),
      getQuickAddChips(),
      getPastExpensePredictions(),
    ]).then(([cats, merch, methods, userCards, upi, banks, chips, preds]) => {
      setRefsLoading(false);
      if (cats.data && cats.data.tree.length > 0) {
        setCategoryTree(cats.data.tree);
        setCategoryFlat(cats.data.flat);
        setClientCachedData("categories_tree_active", cats.data.tree);
        setClientCachedData("categories_flat_budget", cats.data.flat);

        // If form had selected a seed category, sync the real DB category id
        setForm((f) => {
          if (f.category && f.category.categoryId.startsWith("seed-")) {
            const match = cats.data!.flat.find(
              (c) => c.name.toLowerCase() === f.category!.categoryName.toLowerCase() && !c.parent_id
            );
            if (match) {
              return {
                ...f,
                category: {
                  ...f.category,
                  categoryId: match.id,
                },
              };
            }
          }
          return f;
        });
      }
      if (merch.data) {
        setMerchants(merch.data);
        setClientCachedData("merchants_list", merch.data);
      }
      if (methods.data) {
        setPaymentMethods(methods.data);
        setClientCachedData("payment_methods_active", methods.data);
      }
      if (userCards.data) {
        setCards(userCards.data);
        setClientCachedData("user_cards_list", userCards.data);
      }
      if (upi.data) {
        setUpiProfiles(upi.data);
        setClientCachedData("upi_profiles_list", upi.data);
      }
      if (banks.data) {
        setBankAccounts(banks.data);
        setClientCachedData("bank_accounts_list", banks.data);
      }
      if (chips.data) {
        setQuickAddChips(chips.data);
        setClientCachedData("quick_add_chips", chips.data);
      }
      if (preds.data) {
        setPastPredictions(preds.data);
        setClientCachedData("past_expense_predictions", preds.data);
      }
    }).catch(() => {
      // Network hiccup - stop showing "Loading..." so the merchant picker
      // falls back to whatever's cached (or a real "no merchants" state)
      // instead of spinning forever.
      setRefsLoading(false);
    });

    const source = editExpense ?? duplicateFrom;
    if (source) {
      const cat = categoryFlat.find((c) => c.id === source.category_id);
      setForm({
        amount: source.amount,
        itemName: source.item_name,
        merchant: null,
        category: {
          categoryId: source.category_id,
          subcategoryId: source.subcategory_id,
          categoryName: cat?.name ?? source.category_name ?? "Category",
          subcategoryName: null,
        },
        paidBy: source.paid_by,
        expenseType: source.expense_type,
        date: editExpense ? source.expense_date : getTodayISO(),
        time: source.expense_time?.slice(0, 5) ?? "",
        paymentMethod: source.payment_method || "UPI",
        cardId: source.card_id,
        upiProfileId: source.upi_profile_id,
        bankAccountId: source.bank_account_id,
        notes: source.notes ?? "",
        entryType: source.entry_type,
      });
      setCategoryTouched(true);
      setAmountTouched(true);
      setEntryMode("single");
    } else {
      setForm(emptySingleState(userId));
      setCategoryTouched(false);
      setAmountTouched(false);
    }
    setReceiptFile(null);
    setParsedReceipt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editExpense, duplicateFrom]);

  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [priceMemory, setPriceMemory] = useState<ItemPriceMemory | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChangeFlag | null>(null);

  // Receipt attach & scan
  const receiptAttachInputRef = useRef<HTMLInputElement>(null);
  const receiptScanInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null);
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    checkAiConfigured().then((result) => {
      if (result.error === null) setAiConfigured(result.data);
    });
  }, [open]);

  // Price memory suggestion
  useEffect(() => {
    if (!isNewExpense || amountTouched || !open || !form.itemName.trim()) {
      setPriceMemory(null);
      setPriceChange(null);
      return;
    }
    const itemName = form.itemName;
    const timer = setTimeout(() => {
      getItemPriceMemory(itemName).then((result) => {
        if (result.error === null) setPriceMemory(result.data);
      });
      detectPriceChange(itemName).then((result) => {
        if (result.error === null) setPriceChange(result.data);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [form.itemName, amountTouched, open, isNewExpense]);

  function applyPriceMemory() {
    if (!priceMemory) return;
    setForm((f) => ({ ...f, amount: String(priceMemory.last) }));
    setAmountTouched(true);
    setPriceMemory(null);
  }

  // Category suggestions
  useEffect(() => {
    if (categoryTouched || !open || !form.itemName.trim()) {
      setSuggestion(null);
      return;
    }
    const itemName = form.itemName;
    const merchantId = form.merchant?.id ?? null;
    const timer = setTimeout(() => {
      getCategorySuggestion(itemName, merchantId).then((result) => {
        if (result.error === null) setSuggestion(result.data);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [form.itemName, form.merchant, categoryTouched, open]);

  function applySuggestion() {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      category: {
        categoryId: suggestion.categoryId,
        subcategoryId: suggestion.subcategoryId,
        categoryName: suggestion.categoryName,
        subcategoryName: suggestion.subcategoryName,
      },
    }));
    setCategoryTouched(true);
    setSuggestion(null);
  }

  const merchantHint = useMemo(() => {
    if (form.merchant || !form.itemName.trim()) return null;
    const match = suggestMerchant(form.itemName, merchants);
    return match && match.confidence >= 0.7 && match.merchant.name.toLowerCase() !== form.itemName.trim().toLowerCase()
      ? match.merchant
      : null;
  }, [form.itemName, form.merchant, merchants]);

  // Natural Language Entry
  const [nlEntryOpen, setNlEntryOpen] = useState(false);
  const [nlText, setNlText] = useState("");

  function applyNaturalLanguageEntry() {
    if (!nlText.trim()) return;
    const parsed = parseQuickEntry(nlText);
    setForm((f) => ({
      ...f,
      itemName: parsed.itemName || f.itemName,
      amount: parsed.amount !== null ? String(parsed.amount) : f.amount,
      paymentMethod: parsed.paymentMethod ?? f.paymentMethod ?? "UPI",
      date: parsed.expenseDate,
      merchant: null,
    }));
    setNlText("");
    setNlEntryOpen(false);
    toast.message("Parsed — review details");
  }

  // Apply a quick-entry string handed in from outside (Cmd+K command palette
  // "direct NL execution") the moment the sheet opens with one, exactly once
  // per open - never for an edit/duplicate, and never overriding whatever the
  // person types afterwards.
  const appliedQuickEntryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      appliedQuickEntryRef.current = null;
      return;
    }
    if (!initialQuickEntry || editExpense || duplicateFrom) return;
    if (appliedQuickEntryRef.current === initialQuickEntry) return;
    appliedQuickEntryRef.current = initialQuickEntry;

    const parsed = parseQuickEntry(initialQuickEntry);
    setForm((f) => ({
      ...f,
      itemName: parsed.itemName || f.itemName,
      amount: parsed.amount !== null ? String(parsed.amount) : f.amount,
      paymentMethod: parsed.paymentMethod ?? f.paymentMethod ?? "UPI",
      date: parsed.expenseDate,
    }));
    toast.message("Parsed from search — review details");
  }, [open, initialQuickEntry, editExpense, duplicateFrom]);

  // Voice entry - speech-to-text into the same "Smart parse text" box above,
  // reusing parseQuickEntry() rather than a separate path. Deliberately
  // stops short of auto-applying the transcript straight to the form: this
  // app's own rule elsewhere is that an AI/automatically-captured guess
  // (receipt scanning, category suggestions) is always shown for the person
  // to review before it's saved, never applied silently - a misheard amount
  // ("16" vs "60") is exactly the kind of mistake that review step exists
  // to catch, so voice fills the text box and still requires the same one
  // "Parse" tap the typed flow already needs.
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
    );
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startVoiceInput() {
    const SpeechRecognitionCtor =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error("Voice input isn't supported in this browser - try Chrome on Android.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    setNlEntryOpen(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API has no shared TS lib typing across browsers
    const recognition: any = new (SpeechRecognitionCtor as any)();
    recognition.lang = "gu-IN"; // Gujarati (India) - Chrome keeps English/Hinglish loanwords ("UPI", "cash") readable within the transcript too
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      toast.error("Didn't catch that - please try again.");
    };
    recognition.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setNlText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function applyMerchant(merchant: Tables<"merchants">) {
    setForm((f) => ({ ...f, merchant, itemName: merchant.name }));
    if (!categoryTouched && merchant.subcategory_id) {
      const sub = categoryFlat.find((c) => c.id === merchant.subcategory_id);
      const parent = sub ? categoryFlat.find((c) => c.id === sub.parent_id) : null;
      if (sub && parent) {
        setForm((f) => ({
          ...f,
          category: {
            categoryId: parent.id,
            subcategoryId: sub.id,
            categoryName: parent.name,
            subcategoryName: sub.name,
          },
        }));
        setCategoryTouched(true);
        toast.message(`Suggested category: ${parent.name} → ${sub.name}`);
      }
    }
  }

  // --- Real-time Predictive Autocomplete Intelligence ---
  const [predictionDismissed, setPredictionDismissed] = useState(false);

  useEffect(() => {
    setPredictionDismissed(false);
  }, [form.itemName]);

  const predictiveMatches = useMemo(() => {
    const q = form.itemName.trim().toLowerCase();
    if (isEditing || predictionDismissed) return [];

    interface PredictiveCandidate {
      key: string;
      itemName: string;
      amount: number | null;
      categoryId: string;
      subcategoryId: string | null;
      categoryName: string;
      subcategoryName: string | null;
      categoryIcon: string;
      categoryColor: string;
      merchant: Tables<"merchants"> | null;
      paymentMethod: string;
      paidBy: string;
      expenseType: ExpenseType;
      matchType: "history" | "merchant" | "keyword" | "amount";
      badgeLabel: string;
    }

    const results: PredictiveCandidate[] = [];
    const seenKeys = new Set<string>();

    // Reverse price inference: nothing typed in Item/Description yet, but
    // an amount has been entered - suggest past expenses of the same (or
    // very close) amount instead of waiting for the item name. Ranked by
    // exact-amount matches first, then how often that item/amount pair has
    // come up before, then by closeness.
    if (!q) {
      const amt = parseFloat(form.amount);
      if (!amountTouched || !amt || amt <= 0) return [];

      const scored = pastPredictions
        .map((pred) => {
          const diff = Math.abs(pred.amount - amt);
          const pct = diff / Math.max(pred.amount, amt, 1);
          // Time-of-day tiebreaker: when two past purchases cost about the
          // same, prefer whichever category fits right now (e.g. at 8am,
          // prefer a Food & Grocery match over an equally-priced one-off).
          const timeBoost = timeOfDayCategoryBoost(pred.categoryName);
          return { pred, diff, pct, timeBoost };
        })
        .filter((s) => s.diff === 0 || s.pct <= 0.05)
        .sort((a, b) => {
          if (a.diff === 0 && b.diff !== 0) return -1;
          if (b.diff === 0 && a.diff !== 0) return 1;
          if (b.pred.usageCount !== a.pred.usageCount) return b.pred.usageCount - a.pred.usageCount;
          if (b.timeBoost !== a.timeBoost) return b.timeBoost - a.timeBoost;
          return a.diff - b.diff;
        });

      for (const { pred, diff } of scored) {
        const key = `amt::${pred.itemName.toLowerCase()}::${pred.merchantId ?? ""}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const merchObj = pred.merchantId ? merchants.find((m) => m.id === pred.merchantId) ?? null : null;
        results.push({
          key,
          itemName: pred.itemName,
          amount: pred.amount,
          categoryId: pred.categoryId,
          subcategoryId: pred.subcategoryId,
          categoryName: pred.categoryName,
          subcategoryName: pred.subcategoryName,
          categoryIcon: pred.categoryIcon ?? "circle",
          categoryColor: pred.categoryColor ?? "neutral",
          merchant: merchObj,
          paymentMethod: pred.paymentMethod || "UPI",
          paidBy: pred.paidBy,
          expenseType: pred.expenseType,
          matchType: "amount",
          badgeLabel: diff === 0 ? "Same amount before" : `~${formatINR(pred.amount)} before`,
        });
        if (results.length >= 4) break;
      }

      return results;
    }

    // 1. Check past expense history / patterns - exact/substring first
    for (const pred of pastPredictions) {
      const itemMatch = pred.itemName.toLowerCase().includes(q);
      const merchMatch = pred.merchantName?.toLowerCase().includes(q);
      const catMatch =
        pred.categoryName.toLowerCase().includes(q) ||
        (pred.subcategoryName && pred.subcategoryName.toLowerCase().includes(q));

      if (itemMatch || merchMatch || catMatch) {
        const key = `${pred.itemName.toLowerCase()}::${pred.merchantId ?? ""}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const merchObj = pred.merchantId ? merchants.find((m) => m.id === pred.merchantId) ?? null : null;
          results.push({
            key,
            itemName: pred.itemName,
            amount: pred.amount,
            categoryId: pred.categoryId,
            subcategoryId: pred.subcategoryId,
            categoryName: pred.categoryName,
            subcategoryName: pred.subcategoryName,
            categoryIcon: pred.categoryIcon ?? "circle",
            categoryColor: pred.categoryColor ?? "neutral",
            merchant: merchObj,
            paymentMethod: pred.paymentMethod || "UPI",
            paidBy: pred.paidBy,
            expenseType: pred.expenseType,
            matchType: "history",
            badgeLabel: pred.usageCount > 1 ? `${pred.usageCount}x frequent` : "Past expense",
          });
        }
      }
      if (results.length >= 4) break;
    }

    // 1b. Fuzzy typo-tolerant fallback over history, only if the exact pass
    // above didn't already fill up - catches things like "ygesh" for
    // "Yogesh" or "kheero" for "Khiru" from fast mobile typing.
    if (results.length < 4 && q.length >= 3) {
      for (const pred of pastPredictions) {
        const key = `${pred.itemName.toLowerCase()}::${pred.merchantId ?? ""}`;
        if (seenKeys.has(key)) continue;
        const fuzzyItem = fuzzyMatches(pred.itemName, q);
        const fuzzyMerch = pred.merchantName ? fuzzyMatches(pred.merchantName, q) : false;
        if (fuzzyItem || fuzzyMerch) {
          seenKeys.add(key);
          const merchObj = pred.merchantId ? merchants.find((m) => m.id === pred.merchantId) ?? null : null;
          results.push({
            key,
            itemName: pred.itemName,
            amount: pred.amount,
            categoryId: pred.categoryId,
            subcategoryId: pred.subcategoryId,
            categoryName: pred.categoryName,
            subcategoryName: pred.subcategoryName,
            categoryIcon: pred.categoryIcon ?? "circle",
            categoryColor: pred.categoryColor ?? "neutral",
            merchant: merchObj,
            paymentMethod: pred.paymentMethod || "UPI",
            paidBy: pred.paidBy,
            expenseType: pred.expenseType,
            matchType: "history",
            badgeLabel: "Did you mean this?",
          });
        }
        if (results.length >= 4) break;
      }
    }

    // 2. Check Merchants and Aliases - exact/substring first
    if (results.length < 4) {
      for (const m of merchants) {
        const nameMatch = m.name.toLowerCase().includes(q);
        const aliasMatch = Array.isArray(m.aliases) && m.aliases.some((a) => a.toLowerCase().includes(q));

        if (nameMatch || aliasMatch) {
          const key = `${m.name.toLowerCase()}::${m.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const sub = m.subcategory_id ? categoryFlat.find((c) => c.id === m.subcategory_id) : null;
            const parent = sub?.parent_id ? categoryFlat.find((c) => c.id === sub.parent_id) : sub;
            const topCat = parent ? categoryFlat.find((c) => c.id === parent.id) : null;

            results.push({
              key,
              itemName: m.name,
              amount: null,
              categoryId: topCat?.id ?? "seed-shopping",
              subcategoryId: sub?.id ?? null,
              categoryName: topCat?.name ?? "Shopping",
              subcategoryName: sub?.name ?? null,
              categoryIcon: topCat?.icon ?? "store",
              categoryColor: topCat?.color ?? "indigo",
              merchant: m,
              paymentMethod: "UPI",
              paidBy: userId,
              expenseType: "household",
              matchType: "merchant",
              badgeLabel: aliasMatch ? `Alias match: ${q}` : "Merchant",
            });
          }
        }
        if (results.length >= 4) break;
      }
    }

    // 2b. Fuzzy typo-tolerant fallback over merchants/aliases.
    if (results.length < 4 && q.length >= 3) {
      for (const m of merchants) {
        const key = `${m.name.toLowerCase()}::${m.id}`;
        if (seenKeys.has(key)) continue;
        const fuzzyName = fuzzyMatches(m.name, q);
        const fuzzyAlias = Array.isArray(m.aliases) && m.aliases.some((a) => fuzzyMatches(a, q));
        if (fuzzyName || fuzzyAlias) {
          seenKeys.add(key);
          const sub = m.subcategory_id ? categoryFlat.find((c) => c.id === m.subcategory_id) : null;
          const parent = sub?.parent_id ? categoryFlat.find((c) => c.id === sub.parent_id) : sub;
          const topCat = parent ? categoryFlat.find((c) => c.id === parent.id) : null;

          results.push({
            key,
            itemName: m.name,
            amount: null,
            categoryId: topCat?.id ?? "seed-shopping",
            subcategoryId: sub?.id ?? null,
            categoryName: topCat?.name ?? "Shopping",
            subcategoryName: sub?.name ?? null,
            categoryIcon: topCat?.icon ?? "store",
            categoryColor: topCat?.color ?? "indigo",
            merchant: m,
            paymentMethod: "UPI",
            paidBy: userId,
            expenseType: "household",
            matchType: "merchant",
            badgeLabel: "Did you mean this?",
          });
        }
        if (results.length >= 4) break;
      }
    }

    // 3. Check Keyword Map (matchKeywordRule already has its own internal
    // fuzzy fallback - see keyword-map.ts)
    if (results.length < 4) {
      const rule = matchKeywordRule(q);
      if (rule) {
        const topCat = categoryFlat.find((c) => c.name.toLowerCase() === rule.categoryName.toLowerCase() && !c.parent_id);
        const subCat = rule.subcategoryName
          ? categoryFlat.find((c) => c.name.toLowerCase() === rule.subcategoryName?.toLowerCase() && c.parent_id === topCat?.id)
          : null;

        if (topCat) {
          const key = `keyword::${rule.categoryName}::${rule.subcategoryName ?? ""}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push({
              key,
              itemName: form.itemName.trim(),
              amount: null,
              categoryId: topCat.id,
              subcategoryId: subCat?.id ?? null,
              categoryName: topCat.name,
              subcategoryName: subCat?.name ?? null,
              categoryIcon: topCat.icon ?? "sparkles",
              categoryColor: topCat.color ?? "brand",
              merchant: null,
              paymentMethod: "UPI",
              paidBy: userId,
              expenseType: "household",
              matchType: "keyword",
              badgeLabel: "Smart Category",
            });
          }
        }
      }
    }

    return results.slice(0, 4);
  }, [form.itemName, form.amount, amountTouched, isEditing, predictionDismissed, pastPredictions, merchants, categoryFlat, userId]);

  function applyPredictiveMatch(pred: any) {
    setForm((f) => ({
      ...f,
      itemName: pred.itemName,
      amount: pred.amount ? String(pred.amount) : f.amount,
      category: {
        categoryId: pred.categoryId,
        subcategoryId: pred.subcategoryId,
        categoryName: pred.categoryName,
        subcategoryName: pred.subcategoryName,
      },
      merchant: pred.merchant,
      paymentMethod: pred.paymentMethod || f.paymentMethod || "UPI",
      paidBy: pred.paidBy || f.paidBy,
      expenseType: pred.expenseType || f.expenseType,
    }));
    if (pred.amount) setAmountTouched(true);
    setCategoryTouched(true);
    setPredictionDismissed(true);
    toast.success(`⚡ 1-Tap Autofilled for "${pred.itemName}"`, { duration: 2000 });
  }

  function selectQuickCategory(cat: CategoryWithChildren) {
    let realCatId = cat.id;
    if (realCatId.startsWith("seed-")) {
      const match = categoryFlat.find((c) => c.name.toLowerCase() === cat.name.toLowerCase() && !c.parent_id);
      if (match) realCatId = match.id;
    }

    setForm((f) => ({
      ...f,
      category: {
        categoryId: realCatId,
        subcategoryId: null,
        categoryName: cat.name,
        subcategoryName: null,
      },
    }));
    setCategoryTouched(true);
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function handleAttachReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setReceiptFile(file);
    e.target.value = "";
  }

  async function handleScanReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await scanReceipt(dataUrl);
      setScanning(false);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      setReceiptFile(file);
      setParsedReceipt(result.data);
      setReceiptReviewOpen(true);
    } catch {
      setScanning(false);
      toast.error("Couldn't read receipt photo");
    }
  }

  function applyReceiptReview(values: ReceiptReviewValues) {
    setForm((f) => ({
      ...f,
      itemName: values.itemName || f.itemName,
      date: values.date ?? f.date,
      amount: values.amount || f.amount,
    }));
    if (values.amount) setAmountTouched(true);

    if (values.categoryGuess) {
      const guess = values.categoryGuess.trim().toLowerCase();
      const match = categoryFlat.find((c) => !c.parent_id && c.name.toLowerCase().includes(guess));
      if (match) {
        setForm((f) => ({
          ...f,
          category: {
            categoryId: match.id,
            subcategoryId: null,
            categoryName: match.name,
            subcategoryName: null,
          },
        }));
        setCategoryTouched(true);
      }
    }
    toast.message("Reviewed details");
  }

  async function uploadReceiptIfAny(): Promise<string | null> {
    if (!receiptFile) return null;
    try {
      const supabase = createClient();
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile, { contentType: receiptFile.type || "image/jpeg" });
      if (error) {
        toast.error("Couldn't upload receipt — expense will be saved without it");
        return null;
      }
      return path;
    } catch {
      toast.error("Couldn't upload receipt — expense will be saved without it");
      return null;
    }
  }

  // Safe Quick Add Pick: fills the form fields for user review and approval before saving
  function handleQuickAddPick(chip: QuickAddChip) {
    const matchedCategory = categoryFlat.find((c) => c.id === chip.categoryId);
    const matchedSubcategory = chip.subcategoryId ? categoryFlat.find((c) => c.id === chip.subcategoryId) : null;

    setForm((f) => ({
      ...f,
      amount: String(chip.amount),
      itemName: chip.itemName,
      category: {
        categoryId: chip.categoryId,
        subcategoryId: chip.subcategoryId,
        categoryName: matchedCategory?.name ?? "Category",
        subcategoryName: matchedSubcategory?.name ?? null,
      },
      paymentMethod: "UPI",
    }));
    setAmountTouched(true);
    setCategoryTouched(true);
    toast.info(`Loaded "${chip.itemName} ₹${chip.amount}" — tap Save Expense when ready`, { duration: 3000 });
  }

  // Handle Single Expense Submit
  async function handleSubmitSingle() {
    if (!form.category) {
      toast.error("Choose a category");
      return;
    }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (!form.itemName.trim()) {
      toast.error("Enter an item or merchant name");
      return;
    }

    let finalCatId = form.category.categoryId;
    if (finalCatId.startsWith("seed-")) {
      const match = categoryFlat.find((c) => c.name.toLowerCase() === form.category!.categoryName.toLowerCase() && !c.parent_id);
      if (match) finalCatId = match.id;
    }

    setSubmitting(true);
    const payload = {
      amount,
      item_name: form.itemName.trim(),
      category_id: finalCatId,
      subcategory_id: form.category.subcategoryId,
      merchant_id: form.merchant?.id ?? null,
      paid_by: form.paidBy,
      expense_type: form.expenseType,
      entry_type: form.entryType,
      payment_method: form.paymentMethod || "UPI",
      card_id: form.cardId,
      upi_profile_id: form.upiProfileId,
      bank_account_id: form.bankAccountId,
      expense_date: form.date,
      expense_time: form.time ? `${form.time}:00` : null,
      notes: form.notes.trim() || null,
    };

    if (!isEditing && isOffline()) {
      if (receiptFile) toast.message("Receipt will need to be attached again once back online");
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${payload.item_name} queued — will sync when online`);
      onOpenChange(false);
      return;
    }

    try {
      const receiptPath = isEditing ? null : await uploadReceiptIfAny();
      const result = isEditing
        ? await updateExpense(editExpense!.id, payload)
        : await createExpense(payload, undefined, receiptPath);
      setSubmitting(false);

      if (result.error !== null) {
        toast.error(result.error, { action: { label: "Retry", onClick: handleSubmitSingle } });
        return;
      }

      if (!isEditing) onOptimisticAdd?.(result.data);
      onSaved?.(result.data);
      toast.success(isEditing ? "Expense updated" : "Expense added");
      onOpenChange(false);
    } catch (err) {
      setSubmitting(false);
      if (!isEditing && isNetworkError(err)) {
        await queueExpense(payload);
        refreshPendingCount();
        toast.message(`${payload.item_name} queued — will sync when online`);
        onOpenChange(false);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: handleSubmitSingle } });
      }
    }
  }

  // Shopping Mode Handlers
  function updateShoppingRow(key: string, patch: Partial<ShoppingRow>) {
    setShoppingRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addShoppingRow() {
    const last = shoppingRows[shoppingRows.length - 1];
    setShoppingRows((list) => [...list, emptyShoppingRow(last?.category ?? null)]);
  }

  function removeShoppingRow(key: string) {
    setShoppingRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : list));
  }

  const validShoppingRows = shoppingRows.filter((r) => r.itemName.trim() && parseFloat(r.amount) > 0 && r.category);
  const shoppingTotal = validShoppingRows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  async function handleSaveShopping() {
    if (validShoppingRows.length === 0) {
      toast.error("Add at least one item with an amount and category");
      return;
    }
    setSubmitting(true);
    let savedCount = 0;
    for (const row of validShoppingRows) {
      let finalCatId = row.category!.categoryId;
      if (finalCatId.startsWith("seed-")) {
        const match = categoryFlat.find((c) => c.name.toLowerCase() === row.category!.categoryName.toLowerCase() && !c.parent_id);
        if (match) finalCatId = match.id;
      }

      const result = await createExpense({
        amount: parseFloat(row.amount),
        item_name: row.itemName.trim(),
        category_id: finalCatId,
        subcategory_id: row.category!.subcategoryId,
        merchant_id: null,
        paid_by: userId,
        expense_type: "household",
        entry_type: "expense",
        expense_date: getTodayISO(),
      });
      if (result.error !== null) {
        toast.error(`Stopped after ${savedCount} saved — ${result.error}`);
        setSubmitting(false);
        setShoppingRows((list) => list.filter((r) => !validShoppingRows.slice(0, savedCount).some((saved) => saved.key === r.key)));
        return;
      }
      savedCount += 1;
      onSaved?.(result.data);
    }
    setSubmitting(false);
    toast.success(`${savedCount} expense${savedCount === 1 ? "" : "s"} added · ${formatINR(shoppingTotal)}`);
    onOpenChange(false);
  }

  const todayIso = getTodayISO();
  const yesterdayIso = addDaysISO(todayIso, -1);
  const isCustomDate = form.date !== todayIso && form.date !== yesterdayIso;
  const displayDateText = useMemo(() => {
    if (isCustomDate && form.date) {
      try {
        const [y, m, d] = form.date.split("-").map(Number);
        if (y && m && d) {
          const dt = new Date(y, m - 1, d);
          return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
      } catch {
        return form.date;
      }
    }
    return "Choose date";
  }, [form.date, isCustomDate]);

  const handleOpenDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === "function") {
        try {
          dateInputRef.current.showPicker();
        } catch {
          dateInputRef.current.focus();
        }
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  // Top 7 categories for 1-tap quick select (never empty)
  const topCategories = useMemo(() => {
    if (categoryTree && categoryTree.length > 0) {
      return categoryTree.slice(0, 7);
    }
    return DEFAULT_TOP_CATEGORIES.slice(0, 7);
  }, [categoryTree]);

  const activeShoppingRow = shoppingRows.find((r) => r.key === shoppingCategoryRowKey) ?? null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent showClose={false} className="max-w-lg sm:max-w-xl mx-auto max-h-[92dvh] flex flex-col focus:outline-none rounded-t-2xl sm:rounded-t-3xl border-t border-border shadow-2xl bg-card">
          {/* Header */}
          <DrawerHeader className="px-5 pt-4 pb-2.5 border-b border-border/40">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-bold tracking-tight text-foreground">
                {isEditing ? "Edit Expense" : "Add Expense"}
              </DrawerTitle>

              <div className="flex items-center gap-1.5">
                {isNewExpense && entryMode === "single" && aiConfigured && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1.5 text-brand-primary hover:bg-brand-mint/50 font-medium rounded-full"
                    onClick={() => receiptScanInputRef.current?.click()}
                    disabled={scanning}
                  >
                    {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                    <span>{scanning ? "Scanning…" : "Scan receipt"}</span>
                  </Button>
                )}
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            {isNewExpense && (
              <div className="mt-3 grid grid-cols-2 p-1 bg-muted/80 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => setEntryMode("single")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                    entryMode === "single"
                      ? "bg-card text-foreground shadow-sm font-bold scale-[1.01]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Zap className="h-3.5 w-3.5 text-brand-primary" />
                  <span>Single Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("shopping")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                    entryMode === "shopping"
                      ? "bg-card text-foreground shadow-sm font-bold scale-[1.01]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-brand-primary" />
                  <span>Shopping Cart (Multi)</span>
                </button>
              </div>
            )}

            <DrawerDescription className="sr-only">Enter expense amount, item name, and details</DrawerDescription>
          </DrawerHeader>

          {/* SINGLE EXPENSE MODE BODY */}
          {entryMode === "single" ? (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Expense / Income toggle (spec: Module A - general household
                  income, not just the Homemade Business). Always visible, at
                  the very top - not gated by category, since income can now
                  be Salary or Freelancing too, not only a business sale.
                  Switching clears the picked category, since expense and
                  income categories are disjoint (categories.type) and a
                  category picked under one type is never valid under the
                  other. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => (f.entryType === "expense" ? f : { ...f, entryType: "expense", category: null }))}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                    form.entryType === "expense"
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => (f.entryType === "income" ? f : { ...f, entryType: "income", category: null }))}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                    form.entryType === "income"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Income
                </button>
              </div>

              {/* Hero Amount Input with snug Rs position */}
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {form.entryType === "income" ? "Amount Received" : "Amount"}
                </Label>
                <AmountInput
                  value={form.amount}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, amount: v }));
                    setAmountTouched(true);
                  }}
                />

                {priceMemory && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-brand-mint/60 border border-brand-primary/15 px-3 py-2 text-xs text-brand-primary">
                    <span>
                      Last: {formatINR(priceMemory.last)} · Typical: {formatINR(priceMemory.typicalLow)}–{formatINR(priceMemory.typicalHigh)}
                    </span>
                    <button
                      type="button"
                      onClick={applyPriceMemory}
                      className="font-bold underline hover:opacity-80 shrink-0"
                    >
                      Use {formatINR(priceMemory.last)}
                    </button>
                  </div>
                )}
              </div>

              {/* 1-Tap Category Quick Chips with Rich Pastel Colors (Always rendered immediately 0ms) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Category
                  </Label>
                  <button
                    type="button"
                    onClick={() => setCategoryPickerOpen(true)}
                    className="text-xs font-semibold text-brand-primary flex items-center gap-0.5 hover:underline"
                  >
                    {form.category ? "Browse full list" : "All categories"} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Quick Select Chips */}
                <div className="flex flex-wrap gap-2">
                  {topCategories.map((cat) => {
                    const isSelected =
                      (form.category?.categoryId === cat.id ||
                        form.category?.categoryName.toLowerCase() === cat.name.toLowerCase()) &&
                      !form.category.subcategoryId;
                    const swatch = colorSwatch(cat.color);
                    const Icon = getIcon(cat.icon);

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => selectQuickCategory(cat)}
                        style={
                          isSelected
                            ? { backgroundColor: swatch.fg, color: "#ffffff", borderColor: swatch.fg }
                            : { backgroundColor: swatch.bg, color: swatch.fg, borderColor: swatch.bg }
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 shadow-sm",
                          isSelected
                            ? "ring-2 ring-brand-primary/30 ring-offset-1 scale-[1.04] shadow"
                            : "hover:opacity-90 hover:scale-[1.02]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full",
                            isSelected ? "bg-white/20 text-white" : ""
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                        </span>
                        <span>{cat.name}</span>
                        {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCategoryPickerOpen(true)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed transition-all",
                      form.category &&
                        !topCategories.some(
                          (c) =>
                            c.name.toLowerCase() === form.category?.categoryName.toLowerCase() &&
                            !form.category?.subcategoryId
                        )
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm font-bold"
                        : "border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {form.category &&
                      !topCategories.some(
                        (c) =>
                          c.name.toLowerCase() === form.category?.categoryName.toLowerCase() &&
                          !form.category?.subcategoryId
                      )
                        ? form.category.subcategoryName
                          ? `${form.category.categoryName} → ${form.category.subcategoryName}`
                          : form.category.categoryName
                        : "More…"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Item / Description Input */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="item-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Item / Description
                  </Label>
                  {!isEditing && (
                    <div className="flex items-center gap-3">
                      {voiceSupported && (
                        <button
                          type="button"
                          onClick={startVoiceInput}
                          title={listening ? "Stop listening" : "Speak your expense (Gujarati)"}
                          className={cn(
                            "flex items-center gap-1 text-xs font-semibold hover:underline",
                            listening ? "text-destructive" : "text-brand-primary"
                          )}
                        >
                          {listening ? (
                            <>
                              <MicOff className="h-3 w-3 animate-pulse" /> Listening…
                            </>
                          ) : (
                            <>
                              <Mic className="h-3 w-3" /> Speak
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNlEntryOpen(!nlEntryOpen)}
                        className="text-xs text-brand-primary flex items-center gap-1 hover:underline font-semibold"
                      >
                        <Sparkles className="h-3 w-3" />
                        {nlEntryOpen ? "Normal input" : "Smart parse text"}
                      </button>
                    </div>
                  )}
                </div>

                {nlEntryOpen ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={nlText}
                      onChange={(e) => setNlText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyNaturalLanguageEntry()}
                      placeholder='e.g. "Milk 60" or "Zudio 1500 card"'
                      className="flex-1 text-sm h-11"
                    />
                    <Button type="button" size="sm" onClick={applyNaturalLanguageEntry} disabled={!nlText.trim()} className="h-11 px-4 font-semibold">
                      Parse
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="item-name"
                      value={form.itemName}
                      onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value, merchant: null }))}
                      placeholder="e.g. Milk, Groceries, Petrol, Dinner"
                      className="flex-1 text-sm h-11 bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => setMerchantPickerOpen(true)}
                      title="Pick merchant"
                    >
                      <Store className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Real-time Predictive Autocomplete Suggestions */}
                {predictiveMatches.length > 0 && !isEditing && (
                  <div className="mt-2.5 rounded-2xl border border-brand-primary/20 bg-card p-2 shadow-lg space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ring-1 ring-black/5">
                    <div className="flex items-center justify-between px-2 pt-0.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <span className="flex items-center gap-1 text-brand-primary font-bold">
                        <Sparkles className="h-3 w-3 animate-pulse" /> Smart Predictions
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-normal">Tap to 1-click autofill all</span>
                    </div>

                    <div className="space-y-1 pt-1">
                      {predictiveMatches.map((pred) => {
                        const swatch = colorSwatch(pred.categoryColor);
                        const Icon = getIcon(pred.categoryIcon);

                        return (
                          <button
                            key={pred.key}
                            type="button"
                            onClick={() => applyPredictiveMatch(pred)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition-all hover:bg-brand-mint/60 active:scale-[0.99] border border-transparent hover:border-brand-primary/20 group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-2xs group-hover:scale-105 transition-transform"
                                style={{ backgroundColor: swatch.bg, color: swatch.fg }}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate group-hover:text-brand-primary transition-colors">
                                  {pred.itemName}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="truncate">
                                    {pred.subcategoryName
                                      ? `${pred.categoryName} → ${pred.subcategoryName}`
                                      : pred.categoryName}
                                  </span>
                                  {pred.merchant && (
                                    <>
                                      <span>•</span>
                                      <span className="font-medium text-foreground/80 truncate">
                                        {pred.merchant.name}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 pl-2">
                              {pred.amount !== null ? (
                                <span className="text-sm font-bold text-brand-primary font-mono">
                                  {formatINR(pred.amount)}
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  {pred.badgeLabel}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full mt-0.5 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                <Zap className="h-2.5 w-2.5 fill-current" /> Autofill
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Merchant suggestion hint */}
                {merchantHint && !predictiveMatches.some((p) => p.merchant?.id === merchantHint.id) && (
                  <button
                    type="button"
                    onClick={() => applyMerchant(merchantHint)}
                    className="mt-2 flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-left text-xs text-foreground hover:bg-muted/80"
                  >
                    <span>Did you mean <strong>{merchantHint.name}</strong>?</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}

                {/* Smart category hint */}
                {suggestion && predictiveMatches.length === 0 && (
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-brand-mint border border-brand-primary/20 px-3 py-2 text-left text-xs text-brand-primary hover:opacity-95"
                  >
                    <span>
                      Suggested category: <strong>{suggestion.subcategoryName ?? suggestion.categoryName}</strong> ({suggestion.reason})
                    </span>
                    <span className="font-bold underline shrink-0">Apply</span>
                  </button>
                )}
              </div>


              {/* Paid By / Received By */}
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  {form.entryType === "income" ? "Received By" : "Paid By"}
                </Label>
                <PaidBySelector value={form.paidBy} onChange={(v) => setForm((f) => ({ ...f, paidBy: v }))} />
              </div>

              {/* Expense Type */}
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Type
                </Label>
                <ExpenseTypeSelector value={form.expenseType} onChange={(v) => setForm((f) => ({ ...f, expenseType: v }))} />
              </div>

              {/* Payment Method Quick Pills (Default: UPI) */}
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Payment Method
                </Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PAYMENT_METHODS.map((m) => {
                    const isSelected = form.paymentMethod === m.id;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            paymentMethod: isSelected ? null : m.id,
                            cardId: null,
                            upiProfileId: null,
                            bankAccountId: null,
                          }))
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all",
                          isSelected
                            ? "bg-brand-primary text-white border-brand-primary shadow-sm ring-2 ring-brand-primary/20 scale-[1.02]"
                            : "bg-muted text-foreground border-border/60 hover:bg-muted/80"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Specific Instrument Quick Pickers */}
                {(form.paymentMethod === "Credit Card" || form.paymentMethod === "Debit Card") && cards.length > 0 && (
                  <div className="mt-2.5">
                    <CardQuickPicker cards={cards} value={form.cardId} onChange={(v) => setForm((f) => ({ ...f, cardId: v }))} />
                  </div>
                )}
                {form.paymentMethod === "UPI" && upiProfiles.length > 0 && (
                  <div className="mt-2.5">
                    <UpiQuickPicker profiles={upiProfiles} value={form.upiProfileId} onChange={(v) => setForm((f) => ({ ...f, upiProfileId: v }))} />
                  </div>
                )}
                {form.paymentMethod === "Bank Transfer" && bankAccounts.length > 0 && (
                  <div className="mt-2.5">
                    <BankQuickPicker accounts={bankAccounts} value={form.bankAccountId} onChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))} />
                  </div>
                )}
              </div>

              {/* Date - its own row; on narrow phones the Today/Yesterday pills
                  get their own line and the native date input gets full
                  width below them, instead of all three fighting for space
                  in one cramped row. */}
              {/* Date */}
              <div className="pt-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Date
                </Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, date: todayIso }))}
                    className={cn(
                      "shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all",
                      form.date === todayIso
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                        : "bg-muted text-foreground border-border/60 hover:bg-muted/80"
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, date: yesterdayIso }))}
                    className={cn(
                      "shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all",
                      form.date === yesterdayIso
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                        : "bg-muted text-foreground border-border/60 hover:bg-muted/80"
                    )}
                  >
                    Yesterday
                  </button>

                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={handleOpenDatePicker}
                      className={cn(
                        "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        isCustomDate
                          ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                          : "bg-muted text-foreground border-border/60 hover:bg-muted/80"
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{displayDateText}</span>
                    </button>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={form.date}
                      onChange={(e) => {
                        if (e.target.value) {
                          setForm((f) => ({ ...f, date: e.target.value }));
                        }
                      }}
                      onClick={(e) => {
                        try {
                          if (typeof e.currentTarget.showPicker === "function") {
                            e.currentTarget.showPicker();
                          }
                        } catch {}
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      aria-label="Pick custom date"
                    />
                  </div>
                </div>
              </div>

              {/* Notes - its own full-width row (was previously squeezed into
                  a 2-col grid alongside Date, which is what forced Date's
                  row so tight on mobile in the first place). */}
              <div>
                <Label htmlFor="notes" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Notes (Optional)
                </Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Split with friends, monthly bill"
                  className="h-9 text-xs bg-background"
                />
              </div>

              {/* Receipt Attachment Status */}
              {receiptFile && (
                <div className="flex items-center justify-between rounded-xl bg-brand-mint/60 border border-brand-primary/20 px-3.5 py-2 text-xs text-brand-primary">
                  <span className="flex items-center gap-2 font-semibold truncate">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    {receiptFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* SHOPPING / MULTI-ITEM MODE BODY */
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Add multiple items from a grocery or mart run in one go. Each item becomes its own individually tracked expense.
              </p>

              <div className="flex flex-col gap-2.5">
                {shoppingRows.map((row, i) => (
                  <div
                    key={row.key}
                    className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface p-2.5 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Input
                        value={row.itemName}
                        onChange={(e) => updateShoppingRow(row.key, { itemName: e.target.value })}
                        placeholder={`Item ${i + 1}, e.g. Milk, Apples`}
                        className="h-9 text-sm bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setShoppingCategoryRowKey(row.key)}
                        className="flex h-8 items-center justify-between rounded-md bg-muted px-2.5 text-left text-xs text-foreground hover:bg-muted/80"
                      >
                        <span className="truncate font-medium">
                          {row.category
                            ? `${row.category.categoryName}${row.category.subcategoryName ? ` · ${row.category.subcategoryName}` : ""}`
                            : "Choose category"}
                        </span>
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    </div>

                    <Input
                      value={row.amount}
                      onChange={(e) => updateShoppingRow(row.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                      inputMode="decimal"
                      placeholder="₹0"
                      className="h-9 w-24 text-right font-bold text-sm bg-background"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeShoppingRow(row.key)}
                      disabled={shoppingRows.length === 1}
                      aria-label="Remove item"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addShoppingRow}
                  className="w-full h-10 border-dashed gap-1.5 text-xs font-bold"
                >
                  <Plus className="h-4 w-4" /> Add another item
                </Button>
              </div>
            </div>
          )}

          {/* Footer Action */}
          <DrawerFooter className="px-5 py-3.5 border-t border-border/40 bg-card">
            {entryMode === "single" ? (
              <Button
                size="lg"
                className="w-full h-12 text-base font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md rounded-xl"
                onClick={handleSubmitSingle}
                loading={submitting}
              >
                {isEditing ? "Save changes" : "Save Expense"}
              </Button>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{validShoppingRows.length} item{validShoppingRows.length === 1 ? "" : "s"} ready</span>
                  <span className="text-sm font-bold text-foreground">Total: {formatINR(shoppingTotal)}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md rounded-xl"
                  onClick={handleSaveShopping}
                  disabled={submitting || validShoppingRows.length === 0}
                  loading={submitting}
                >
                  Save all {validShoppingRows.length > 0 ? `(${validShoppingRows.length} items)` : ""}
                </Button>
              </div>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Hidden File Inputs */}
      <input ref={receiptAttachInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttachReceipt} />
      <input ref={receiptScanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanReceipt} />

      {/* Category Picker for Single Mode */}
      <CategoryPicker
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        tree={form.entryType === "income" ? incomeCategoryTree : expenseCategoryTree}
        onSelect={(selection) => {
          setForm((f) => ({ ...f, category: selection }));
          setCategoryTouched(true);
        }}
        onCategoryCreated={(cat) => {
          setCategoryTree((t) => [...t, cat]);
          setClientCachedData("categories_tree_active", [...categoryTree, cat]);
        }}
      />

      {/* Category Picker for Shopping Rows - always expense-scoped, since Shopping mode has no Income toggle */}
      <CategoryPicker
        open={!!shoppingCategoryRowKey}
        onOpenChange={(op) => !op && setShoppingCategoryRowKey(null)}
        tree={expenseCategoryTree}
        onSelect={(selection) => {
          if (activeShoppingRow) {
            updateShoppingRow(activeShoppingRow.key, { category: selection });
          }
          setShoppingCategoryRowKey(null);
        }}
        onCategoryCreated={(cat) => {
          setCategoryTree((t) => [...t, cat]);
          setClientCachedData("categories_tree_active", [...categoryTree, cat]);
        }}
      />

      {/* Merchant Picker */}
      <MerchantPicker
        open={merchantPickerOpen}
        onOpenChange={setMerchantPickerOpen}
        merchants={merchants}
        loading={refsLoading}
        onSelect={applyMerchant}
        onMerchantCreated={(m) => {
          setMerchants((list) => [...list, m]);
          setClientCachedData("merchants_list", [...merchants, m]);
        }}
      />

      {/* Receipt Review */}
      <ReceiptReviewSheet
        open={receiptReviewOpen}
        onOpenChange={setReceiptReviewOpen}
        parsed={parsedReceipt}
        onConfirm={applyReceiptReview}
      />
    </>
  );
}

export const AddExpenseDrawer = AddExpenseSheet;
