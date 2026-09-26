"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Copy,
  SlidersHorizontal,
  ListPlus,
  Calculator,
  RotateCcw,
  ShoppingBag,
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
import { matchKeywordRule, KEYWORD_RULES } from "@/lib/expense-intelligence/keyword-map";
import { fuzzyMatches } from "@/lib/expense-intelligence/fuzzy-match";
import { timeOfDayCategoryBoost } from "@/lib/expense-intelligence/time-of-day";
import { detectPriceChange, type PriceChangeFlag } from "@/lib/actions/insights";
import { ReceiptReviewSheet, type ReceiptReviewValues } from "@/components/shared/receipt-review-sheet";
import { checkAiConfigured, scanReceipt } from "@/lib/actions/receipts";
import type { ParsedReceipt } from "@/lib/ai/receipt-parser";
import { createClient } from "@/lib/supabase/client";
import { getClientCachedData, setClientCachedData } from "@/lib/cache/client-cache";
import { listAutomationRules, recordRuleExecution } from "@/lib/actions/automation-rules";
import { matchAutomationRule, resolveRuleActions, type AutomationRule } from "@/lib/expense-intelligence/automation-rules";
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

export interface ShoppingRow {
  key: string;
  itemName: string;
  amount: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  useMultiplier: boolean;
  category: CategorySelection | null;
  merchant: Tables<"merchants"> | null;
  expenseType: ExpenseType;
  notes: string;
  isExpanded: boolean;
}

function emptyShoppingRow(
  carryOver: CategorySelection | null = null,
  defaultExpenseType: ExpenseType = "household",
  defaultMerchant: Tables<"merchants"> | null = null
): ShoppingRow {
  return {
    key: crypto.randomUUID(),
    itemName: "",
    amount: "",
    quantity: "1",
    unitPrice: "",
    unit: "pcs",
    useMultiplier: false,
    category: carryOver,
    merchant: defaultMerchant,
    expenseType: defaultExpenseType,
    notes: "",
    isExpanded: false,
  };
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

const COMMON_SHOPPING_MERCHANT_NAMES = [
  "DMart",
  "Blinkit",
  "Zepto",
  "Swiggy Instamart",
  "Reliance Fresh",
  "BigBasket",
  "Nature's Basket",
  "Local Kirana",
];

const COMMON_INCOME_SOURCE_NAMES = [
  "LuxeKraft.Shop",
  "Website Orders",
  "Amazon Seller Payout",
  "Instagram DM",
  "Direct Client",
  "Cash Sale",
];

const SHOPPING_UNITS = ["pcs", "kg", "g", "L", "ml", "pack", "box", "dozen"];

const COMMON_PAYMENT_METHODS = [
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "Credit Card", label: "Credit Card", icon: CreditCard },
  { id: "Debit Card", label: "Debit Card", icon: CreditCard },
  { id: "Cash", label: "Cash", icon: Banknote },
  { id: "Bank Transfer", label: "Bank", icon: Landmark },
];

/** Pre-seeded instant top categories (0ms fallback before or during network cache hydration) */
const DEFAULT_TOP_CATEGORIES: CategoryWithChildren[] = [
  {
    id: "seed-food",
    name: "Food & Grocery",
    icon: "shopping-basket",
    color: "green",
    sort_order: 10,
    parent_id: null,
    household_id: null,
    is_active: true,
    type: "expense",
    created_at: "",
    children: [
      { id: "seed-sub-food-delivery", name: "Food Delivery", icon: "utensils", color: "green", sort_order: 15, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
      { id: "seed-sub-grocery", name: "Grocery", icon: "shopping-basket", color: "green", sort_order: 8, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
      { id: "seed-sub-milk", name: "Milk", icon: "milk", color: "green", sort_order: 1, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
      { id: "seed-sub-vegetables", name: "Vegetables", icon: "carrot", color: "green", sort_order: 6, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
      { id: "seed-sub-fruits", name: "Fruits", icon: "apple", color: "green", sort_order: 7, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
      { id: "seed-sub-snacks", name: "Snacks", icon: "cookie", color: "green", sort_order: 9, parent_id: "seed-food", household_id: null, is_active: true, type: "expense", created_at: "" },
    ],
  },
  { id: "seed-shopping", name: "Shopping", icon: "shopping-bag", color: "pink", sort_order: 20, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-fashion", name: "Fashion", icon: "shirt", color: "purple", sort_order: 30, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-household", name: "Household", icon: "home", color: "amber", sort_order: 50, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-transport", name: "Transport", icon: "car", color: "orange", sort_order: 60, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-health", name: "Health", icon: "heart-pulse", color: "red", sort_order: 70, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
  { id: "seed-personal", name: "Personal", icon: "user", color: "teal", sort_order: 80, parent_id: null, household_id: null, is_active: true, type: "expense", created_at: "", children: [] },
];

const DEFAULT_TOP_INCOME_CATEGORIES: CategoryWithChildren[] = [
  {
    id: "seed-mobile-covers",
    name: "Mobile Covers & Sets",
    icon: "smartphone",
    color: "blue",
    sort_order: 110,
    parent_id: null,
    household_id: null,
    is_active: true,
    type: "income",
    created_at: "",
    children: [
      { id: "seed-sub-mobile-cover", name: "Mobile Cover", icon: "smartphone", color: "blue", sort_order: 1, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-jul", name: "Cover + Jul", icon: "smartphone", color: "blue", sort_order: 2, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-judo", name: "Cover + Waist Judo", icon: "smartphone", color: "blue", sort_order: 3, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-short-chain", name: "Cover + Short Chain", icon: "smartphone", color: "blue", sort_order: 4, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-feather", name: "Cover + Feather", icon: "smartphone", color: "blue", sort_order: 5, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-judo-jul", name: "Cover + Waist Judo + Jul", icon: "smartphone", color: "blue", sort_order: 6, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-sling-ghugri", name: "Cover + Sling Chain with Ghugri", icon: "smartphone", color: "blue", sort_order: 7, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-sling-coins-kodi", name: "Cover + Sling Chain with Ghugri, Coins & Metal Kodi", icon: "smartphone", color: "blue", sort_order: 8, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-short-judo", name: "Cover + Short Chain + Waist Judo", icon: "smartphone", color: "blue", sort_order: 9, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-cover-feather-jul", name: "Cover + Feather With Jul", icon: "smartphone", color: "blue", sort_order: 10, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-full-set-1", name: "Full Set 1: Cover + Waist Judo + Sling Chain with Ghugri", icon: "smartphone", color: "blue", sort_order: 11, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-full-set-2", name: "Full Set 2: Cover + Waist Judo + Sling Chain with Ghugri, Coins & Metal Kodi", icon: "smartphone", color: "blue", sort_order: 12, parent_id: "seed-mobile-covers", household_id: null, is_active: true, type: "income", created_at: "" },
    ],
  },
  {
    id: "seed-accessories",
    name: "Only Accessories",
    icon: "sparkles",
    color: "purple",
    sort_order: 111,
    parent_id: null,
    household_id: null,
    is_active: true,
    type: "income",
    created_at: "",
    children: [
      { id: "seed-sub-sling-ghugri", name: "Only Sling Chain with Ghugri", icon: "sparkles", color: "purple", sort_order: 1, parent_id: "seed-accessories", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-sling-coins-kodi", name: "Only Sling Chain with Ghugri, Coins & Metal Kodi", icon: "sparkles", color: "purple", sort_order: 2, parent_id: "seed-accessories", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-waist-judo", name: "Only Waist Judo", icon: "sparkles", color: "purple", sort_order: 3, parent_id: "seed-accessories", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-macrame-sling", name: "Macrame Mobile Sling", icon: "package", color: "purple", sort_order: 4, parent_id: "seed-accessories", household_id: null, is_active: true, type: "income", created_at: "" },
    ],
  },
  {
    id: "seed-jewellery-watches",
    name: "Handmade Jewellery, Watches & Collections",
    icon: "gem",
    color: "pink",
    sort_order: 112,
    parent_id: null,
    household_id: null,
    is_active: true,
    type: "income",
    created_at: "",
    children: [
      { id: "seed-sub-haldi-jewellery", name: "Haldi Jewellery", icon: "sun", color: "pink", sort_order: 1, parent_id: "seed-jewellery-watches", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-mehndi-jewellery", name: "Mehndi Jewellery", icon: "sparkles", color: "pink", sort_order: 2, parent_id: "seed-jewellery-watches", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-navratri-collection", name: "Navratri Collection", icon: "flower-2", color: "pink", sort_order: 3, parent_id: "seed-jewellery-watches", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-other-jewellery", name: "Other Handmade Jewellery", icon: "gem", color: "pink", sort_order: 4, parent_id: "seed-jewellery-watches", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-kashmiri-watch", name: "Kashmiri Watch", icon: "watch", color: "pink", sort_order: 5, parent_id: "seed-jewellery-watches", household_id: null, is_active: true, type: "income", created_at: "" },
    ],
  },
  {
    id: "seed-crafts-occasions",
    name: "Handmade Crafts & Occasions",
    icon: "palette",
    color: "amber",
    sort_order: 113,
    parent_id: null,
    household_id: null,
    is_active: true,
    type: "income",
    created_at: "",
    children: [
      { id: "seed-sub-lippon-art", name: "Lippon Art", icon: "palette", color: "amber", sort_order: 1, parent_id: "seed-crafts-occasions", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-return-gift", name: "Return Gift", icon: "gift", color: "amber", sort_order: 2, parent_id: "seed-crafts-occasions", household_id: null, is_active: true, type: "income", created_at: "" },
      { id: "seed-sub-baby-shower", name: "Baby Shower", icon: "baby", color: "amber", sort_order: 3, parent_id: "seed-crafts-occasions", household_id: null, is_active: true, type: "income", created_at: "" },
    ],
  },
  { id: "seed-business-sales", name: "Business Sales & Payouts", icon: "shopping-bag", color: "indigo", sort_order: 102, parent_id: null, household_id: null, is_active: true, type: "income", created_at: "", children: [] },
  { id: "seed-salary", name: "Salary", icon: "banknote", color: "emerald", sort_order: 100, parent_id: null, household_id: null, is_active: true, type: "income", created_at: "", children: [] },
  { id: "seed-freelance", name: "Freelancing & Consulting", icon: "laptop", color: "blue", sort_order: 101, parent_id: null, household_id: null, is_active: true, type: "income", created_at: "", children: [] },
];

export const LUXEKRAFT_INCOME_QUICK_CHIPS = [
  // Mobile Covers & Combos (Current Offer Prices)
  { itemName: "Cover Only", categoryName: "Mobile Covers & Sets", subcategoryName: "Mobile Cover", amount: 1099 },
  { itemName: "Cover + Jul", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Jul", amount: 1299 },
  { itemName: "Cover + Waist Judo", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Waist Judo", amount: 1399 },
  { itemName: "Cover + Short Chain", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Short Chain", amount: 1499 },
  { itemName: "Cover + Feather", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Feather", amount: 1499 },
  { itemName: "Cover + Waist Judo + Jul", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Waist Judo + Jul", amount: 1499 },
  { itemName: "Cover + Sling Chain with Ghugri", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Sling Chain with Ghugri", amount: 1599 },
  { itemName: "Cover + Sling Chain with Ghugri, Coins & Metal Kodi", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Sling Chain with Ghugri, Coins & Metal Kodi", amount: 1699 },
  { itemName: "Cover + Short Chain + Waist Judo (2 in 1)", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Short Chain + Waist Judo", amount: 1699 },
  { itemName: "Cover + Feather With Jul", categoryName: "Mobile Covers & Sets", subcategoryName: "Cover + Feather With Jul", amount: 1699 },
  { itemName: "Full Set 1 (Cover + Waist Judo + Sling Ghugri)", categoryName: "Mobile Covers & Sets", subcategoryName: "Full Set 1: Cover + Waist Judo + Sling Chain with Ghugri", amount: 1899 },
  { itemName: "Full Set 2 (Cover + Judo + Coins & Metal Kodi)", categoryName: "Mobile Covers & Sets", subcategoryName: "Full Set 2: Cover + Waist Judo + Sling Chain with Ghugri, Coins & Metal Kodi", amount: 1999 },

  // Standalone Accessories
  { itemName: "Only Sling Chain with Ghugri", categoryName: "Only Accessories", subcategoryName: "Only Sling Chain with Ghugri", amount: 599 },
  { itemName: "Only Sling Chain with Ghugri, Coins & Metal Kodi", categoryName: "Only Accessories", subcategoryName: "Only Sling Chain with Ghugri, Coins & Metal Kodi", amount: 699 },
  { itemName: "Only Waist Judo", categoryName: "Only Accessories", subcategoryName: "Only Waist Judo", amount: 599 },
  { itemName: "Macramé Mobile Sling", categoryName: "Only Accessories", subcategoryName: "Macrame Mobile Sling", amount: 399 },

  // Custom Name Add-on
  { itemName: "Custom Name on Cover", categoryName: "Mobile Covers & Sets", subcategoryName: "Mobile Cover", amount: 100 },

  // Handmade Jewellery, Watches & Collections
  { itemName: "Kashmiri Watch", categoryName: "Handmade Jewellery, Watches & Collections", subcategoryName: "Kashmiri Watch", amount: 499 },
  { itemName: "Haldi Jewellery (Starts)", categoryName: "Handmade Jewellery, Watches & Collections", subcategoryName: "Haldi Jewellery", amount: 999 },
  { itemName: "Mehndi Jewellery (Starts)", categoryName: "Handmade Jewellery, Watches & Collections", subcategoryName: "Mehndi Jewellery", amount: 999 },
  { itemName: "Navratri Collection (Starts)", categoryName: "Handmade Jewellery, Watches & Collections", subcategoryName: "Navratri Collection", amount: 999 },
  { itemName: "Other Handmade Jewellery", categoryName: "Handmade Jewellery, Watches & Collections", subcategoryName: "Other Handmade Jewellery", amount: 499 },

  // Handmade Crafts & Occasions
  { itemName: "Lippon Art (Starts)", categoryName: "Handmade Crafts & Occasions", subcategoryName: "Lippon Art", amount: 999 },
  { itemName: "Return Gift (Custom)", categoryName: "Handmade Crafts & Occasions", subcategoryName: "Return Gift", amount: 999 },
];

function autoDetectCategoryForShopping(
  itemName: string,
  categoriesTree: CategoryWithChildren[],
  _flatList: Tables<"categories">[],
  entryType: "expense" | "income" = "expense"
): CategorySelection | null {
  if (!itemName || !itemName.trim()) return null;
  const raw = itemName.trim().toLowerCase();

  // 1. Income category auto-detection (LuxeKraft & custom income categories)
  if (entryType === "income") {
    // Check LuxeKraft predefined chips first for highest accuracy
    const chipMatch = LUXEKRAFT_INCOME_QUICK_CHIPS.find(
      (c) =>
        raw.includes(c.itemName.toLowerCase()) ||
        raw.includes(c.subcategoryName.toLowerCase()) ||
        c.itemName.toLowerCase().includes(raw)
    );
    if (chipMatch) {
      const parent = categoriesTree.find(
        (c) => c.name.toLowerCase() === chipMatch.categoryName.toLowerCase() && c.type === "income"
      );
      if (parent) {
        const sub = parent.children.find(
          (s) => s.name.toLowerCase() === chipMatch.subcategoryName.toLowerCase()
        );
        return {
          categoryId: parent.id,
          subcategoryId: sub?.id ?? null,
          categoryName: parent.name,
          subcategoryName: sub?.name ?? chipMatch.subcategoryName,
        };
      }
    }

    // Check Subcategories for income
    for (const cat of categoriesTree) {
      if (cat.type !== "income") continue;
      for (const sub of cat.children) {
        const subLower = sub.name.toLowerCase();
        if (raw.includes(subLower) || (raw.length >= 4 && subLower.includes(raw))) {
          return {
            categoryId: cat.id,
            subcategoryId: sub.id,
            categoryName: cat.name,
            subcategoryName: sub.name,
          };
        }
      }
    }

    // Check Top categories for income
    for (const cat of categoriesTree) {
      if (cat.type !== "income") continue;
      const catLower = cat.name.toLowerCase();
      if (raw.includes(catLower)) {
        return {
          categoryId: cat.id,
          subcategoryId: null,
          categoryName: cat.name,
          subcategoryName: null,
        };
      }
    }

    return null;
  }

  // 2. Expense category auto-detection (Keyword rules, subcategories, top categories)
  for (const rule of KEYWORD_RULES) {
    const isMatched = rule.keywords.some((kw) => {
      const kwLower = kw.toLowerCase();
      const regex = new RegExp(`(^|\\s|[.,/\\-_])${kwLower.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\s|[.,/\\-_]|$)`, "i");
      return regex.test(raw);
    });

    if (isMatched) {
      const parent = categoriesTree.find(
        (c) => c.name.toLowerCase() === rule.categoryName.toLowerCase() && c.type !== "income"
      );
      if (parent) {
        const sub = rule.subcategoryName
          ? parent.children.find((s) => s.name.toLowerCase() === rule.subcategoryName?.toLowerCase())
          : null;
        return {
          categoryId: parent.id,
          subcategoryId: sub?.id ?? null,
          categoryName: parent.name,
          subcategoryName: sub?.name ?? null,
        };
      }
    }
  }

  for (const cat of categoriesTree) {
    if (cat.type === "income") continue;
    for (const sub of cat.children) {
      const subLower = sub.name.toLowerCase();
      if (raw.includes(subLower) || (raw.length >= 4 && subLower.includes(raw))) {
        return {
          categoryId: cat.id,
          subcategoryId: sub.id,
          categoryName: cat.name,
          subcategoryName: sub.name,
        };
      }
    }
  }

  for (const cat of categoriesTree) {
    if (cat.type === "income") continue;
    const catLower = cat.name.toLowerCase();
    if (raw.includes(catLower)) {
      return {
        categoryId: cat.id,
        subcategoryId: null,
        categoryName: cat.name,
        subcategoryName: null,
      };
    }
  }

  return null;
}

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
  const { userId, householdId, displayName, partner } = useHousehold();
  const { refreshPendingCount } = useOffline();
  const isEditing = !!editExpense;
  const isNewExpense = !isEditing && !duplicateFrom;

  // Active Tab Mode: 'single' | 'shopping'
  const [entryMode, setEntryMode] = useState<"single" | "shopping">(initialMode);
  const [multiEntryType, setMultiEntryType] = useState<"expense" | "income">("expense");

  // Single mode state
  const [form, setForm] = useState(() => emptySingleState(userId));
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [open, entryMode]);

  // Shopping mode state
  const [shoppingRows, setShoppingRows] = useState<ShoppingRow[]>([emptyShoppingRow(null)]);
  const [shoppingCategoryRowKey, setShoppingCategoryRowKey] = useState<string | null>(null);
  const [shoppingMerchantPickerTarget, setShoppingMerchantPickerTarget] = useState<"trip" | string | null>(null);

  // Shopping Trip metadata (Trip-level defaults applied across all cart items)
  const [tripMerchant, setTripMerchant] = useState<Tables<"merchants"> | null>(null);
  const [tripDate, setTripDate] = useState<string>(getTodayISO());
  const [tripPaidBy, setTripPaidBy] = useState<string>(userId);
  const [tripExpenseType, setTripExpenseType] = useState<ExpenseType>("household");
  const [tripPaymentMethod, setTripPaymentMethod] = useState<string | null>("UPI");
  const [tripCardId, setTripCardId] = useState<string | null>(null);
  const [tripUpiProfileId, setTripUpiProfileId] = useState<string | null>(null);
  const [tripBankAccountId, setTripBankAccountId] = useState<string | null>(null);
  const [tripNotes, setTripNotes] = useState<string>("");
  const [showTripSettings, setShowTripSettings] = useState<boolean>(false);
  const tripDateInputRef = useRef<HTMLInputElement>(null);

  // Power tools state
  const [bulkPasteOpen, setBulkPasteOpen] = useState<boolean>(false);
  const [bulkPasteText, setBulkPasteText] = useState<string>("");
  const [shoppingListening, setShoppingListening] = useState<boolean>(false);
  const shoppingSpeechRecRef = useRef<{ stop: () => void } | null>(null);

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
  // Track merchant-specific loading state (instant fallback if cached)
  const [merchantsLoading, setMerchantsLoading] = useState(
    () => !getClientCachedData<Tables<"merchants">[]>("merchants_list")
  );

  // Smart Rules (spec: Module 1) - keyword-triggered auto-fill.
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(
    () => getClientCachedData<AutomationRule[]>("automation_rules_list") ?? []
  );
  const [appliedRule, setAppliedRule] = useState<{ id: string; name: string } | null>(null);
  const lastRuleCheckedText = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setEntryMode(initialMode);
    setShoppingRows([emptyShoppingRow(null, "household", null)]);
    setTripMerchant(null);
    setTripDate(getTodayISO());
    setTripPaidBy(userId);
    setTripExpenseType("household");
    setTripPaymentMethod("UPI");
    setTripCardId(null);
    setTripUpiProfileId(null);
    setTripBankAccountId(null);
    setTripNotes("");
    setShowTripSettings(false);
    setBulkPasteOpen(false);
    setBulkPasteText("");
    const hasCachedMerchants = !!getClientCachedData<Tables<"merchants">[]>("merchants_list");
    setMerchantsLoading(!hasCachedMerchants);
    setAppliedRule(null);
    lastRuleCheckedText.current = null;

    // Refresh each reference dataset independently for instant UI hydration
    listCategoriesForHousehold().then((cats) => {
      if (cats.data && cats.data.tree.length > 0) {
        setCategoryTree(cats.data.tree);
        setCategoryFlat(cats.data.flat);
        setClientCachedData("categories_tree_active", cats.data.tree);
        setClientCachedData("categories_flat_budget", cats.data.flat);

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
    });

    listMerchantsForHousehold().then((merch) => {
      setMerchantsLoading(false);
      if (merch.data) {
        setMerchants(merch.data);
        setClientCachedData("merchants_list", merch.data);
      }
    }).catch(() => {
      setMerchantsLoading(false);
    });

    listPaymentMethodsForHousehold().then((methods) => {
      if (methods.data) {
        setPaymentMethods(methods.data);
        setClientCachedData("payment_methods_active", methods.data);
      }
    });

    listUserCards().then((userCards) => {
      if (userCards.data) {
        setCards(userCards.data);
        setClientCachedData("user_cards_list", userCards.data);
      }
    });

    listUpiProfiles().then((upi) => {
      if (upi.data) {
        setUpiProfiles(upi.data);
        setClientCachedData("upi_profiles_list", upi.data);
      }
    });

    listBankAccounts().then((banks) => {
      if (banks.data) {
        setBankAccounts(banks.data);
        setClientCachedData("bank_accounts_list", banks.data);
      }
    });

    getQuickAddChips().then((chips) => {
      if (chips.data) {
        setQuickAddChips(chips.data);
        setClientCachedData("quick_add_chips", chips.data);
      }
    });

    getPastExpensePredictions().then((preds) => {
      if (preds.data) {
        setPastPredictions(preds.data);
        setClientCachedData("past_expense_predictions", preds.data);
      }
    });

    listAutomationRules().then((rules) => {
      if (rules.data) {
        setAutomationRules(rules.data);
        setClientCachedData("automation_rules_list", rules.data);
      }
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
      setMultiEntryType(source.entry_type === "income" ? "income" : "expense");
      setNlEntryOpen(false);
      setNlText("");
    } else {
      setForm(emptySingleState(userId));
      setCategoryTouched(false);
      setAmountTouched(false);
      setEntryMode(initialMode);
      setMultiEntryType("expense");
      setNlEntryOpen(true);
      setNlText("");
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
    const rawName = typeof form.itemName === "string" ? form.itemName.trim() : "";
    if (!isNewExpense || amountTouched || !open || !rawName) {
      setPriceMemory(null);
      setPriceChange(null);
      return;
    }
    const itemName = rawName;
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
    const rawName = typeof form.itemName === "string" ? form.itemName.trim() : "";
    if (categoryTouched || !open || !rawName) {
      setSuggestion(null);
      return;
    }
    const itemName = rawName;
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

  // Smart Rules auto-fill (spec: Module 1) - runs ahead of the manual
  // "suggestion" pill above: when the typed/spoken text matches an active
  // rule's keywords, apply its actions immediately (0ms, no click needed)
  // and show a "Auto-filled by rule" badge, rather than waiting for the
  // user to accept a suggestion. Only fires while the user hasn't already
  // touched category/merchant themselves, so it never clobbers a manual
  // choice, and only once per distinct item text (lastRuleCheckedText)
  // so retyping the same text doesn't keep re-triggering it.
  useEffect(() => {
    if (!open || isEditing) return;
    const text = typeof form.itemName === "string" ? form.itemName.trim() : "";
    if (!text) {
      setAppliedRule(null);
      lastRuleCheckedText.current = null;
      return;
    }
    if (categoryTouched || form.merchant || text === lastRuleCheckedText.current) return;
    lastRuleCheckedText.current = text;

    const amount = parseFloat(form.amount);
    const rule = matchAutomationRule(text, automationRules, {
      amount: Number.isFinite(amount) ? amount : null,
      entryType: form.entryType,
    });
    if (!rule) return;

    const members = [
      { id: userId, displayName },
      ...(partner ? [{ id: partner.id, displayName: partner.displayName }] : []),
    ];
    const resolved = resolveRuleActions(rule, categoryTree, merchants, members);
    applyMatchedRule(rule, resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itemName, form.amount, form.entryType, categoryTouched, form.merchant, open, isEditing, automationRules, categoryTree, merchants]);

  function applyMatchedRule(
    rule: AutomationRule,
    resolved: ReturnType<typeof resolveRuleActions>
  ) {
    setForm((f) => ({
      ...f,
      entryType: resolved.entryType ?? f.entryType,
      category: resolved.category ?? f.category,
      merchant: resolved.merchant ?? f.merchant,
      paidBy: resolved.paidBy ?? f.paidBy,
      paymentMethod: resolved.paymentMethod ?? f.paymentMethod,
    }));
    if (resolved.category) setCategoryTouched(true);
    setAppliedRule({ id: rule.id, name: rule.name });
  }

  const merchantHint = useMemo(() => {
    const rawName = typeof form.itemName === "string" ? form.itemName.trim() : "";
    if (form.merchant || !rawName) return null;
    const match = suggestMerchant(rawName, merchants);
    return match && match.confidence >= 0.7 && match.merchant.name.toLowerCase() !== rawName.toLowerCase()
      ? match.merchant
      : null;
  }, [form.itemName, form.merchant, merchants]);

  // Natural Language Entry
  const [nlEntryOpen, setNlEntryOpen] = useState(!editExpense && !duplicateFrom);
  const [nlText, setNlText] = useState("");

  const resolveNaturalLanguage = (text: string) => {
    if (!text || typeof text !== "string" || !text.trim()) return null;
    const parsed = parseQuickEntry(text);

    // 1. Merchant Resolution
    let matchedMerchant: Tables<"merchants"> | null = null;
    const merchantCandidate = parsed.merchantHint || parsed.itemName;
    if (merchantCandidate && merchants.length > 0) {
      const match = suggestMerchant(merchantCandidate, merchants);
      if (match && match.confidence >= 0.6) {
        matchedMerchant = match.merchant;
      }
    }

    // 2. Category Resolution
    let matchedCategory: CategorySelection | null = null;
    const activeTree = parsed.entryType === "income" ? incomeCategoryTree : expenseCategoryTree;

    // (a) Keyword rule match
    const keywordMatch = matchKeywordRule(parsed.itemName.toLowerCase());
    if (keywordMatch) {
      const top = activeTree.find(
        (c) => c.name.toLowerCase() === keywordMatch.categoryName.toLowerCase()
      );
      if (top) {
        const sub = keywordMatch.subcategoryName
          ? top.children.find((s) => s.name.toLowerCase() === keywordMatch.subcategoryName?.toLowerCase())
          : null;
        matchedCategory = {
          categoryId: top.id,
          subcategoryId: sub?.id ?? null,
          categoryName: top.name,
          subcategoryName: sub?.name ?? null,
        };
      }
    }

    // (b) Category tree substring match if no keyword match
    if (!matchedCategory) {
      const lower = parsed.itemName.toLowerCase();
      for (const top of activeTree) {
        if (lower.includes(top.name.toLowerCase())) {
          matchedCategory = {
            categoryId: top.id,
            subcategoryId: null,
            categoryName: top.name,
            subcategoryName: null,
          };
          break;
        }
        for (const sub of top.children) {
          if (lower.includes(sub.name.toLowerCase())) {
            matchedCategory = {
              categoryId: top.id,
              subcategoryId: sub.id,
              categoryName: top.name,
              subcategoryName: sub.name,
            };
            break;
          }
        }
        if (matchedCategory) break;
      }
    }

    // 3. Card & Bank instrument match
    let resolvedCardId: string | null = null;
    let resolvedUpiId: string | null = null;
    let resolvedBankId: string | null = null;
    let resolvedPaymentMethod = parsed.paymentMethod ?? form.paymentMethod ?? "UPI";

    if (parsed.cardHint && cards.length > 0) {
      const foundCard = cards.find(
        (c) =>
          c.issuer_name?.toLowerCase().includes(parsed.cardHint!.toLowerCase()) ||
          c.custom_name?.toLowerCase().includes(parsed.cardHint!.toLowerCase())
      );
      if (foundCard) {
        resolvedCardId = foundCard.id;
        resolvedPaymentMethod = foundCard.card_type === "debit" ? "Debit Card" : "Credit Card";
      }
    }

    if (parsed.upiHint && upiProfiles.length > 0) {
      const hintLower = parsed.upiHint.toLowerCase();
      const foundUpi = upiProfiles.find(
        (u) =>
          u.label?.toLowerCase().includes(hintLower) ||
          u.upi_app?.toLowerCase().includes(hintLower) ||
          u.linked_bank_name?.toLowerCase().includes(hintLower)
      );
      if (foundUpi) {
        resolvedUpiId = foundUpi.id;
        resolvedPaymentMethod = "UPI";
      }
    }

    if (parsed.bankHint && bankAccounts.length > 0) {
      const foundBank = bankAccounts.find((b) =>
        b.bank_name.toLowerCase().includes(parsed.bankHint!.toLowerCase())
      );
      if (foundBank) {
        resolvedBankId = foundBank.id;
        resolvedPaymentMethod = "Bank Transfer";
      }
    }

    // 4. Paid by resolution
    let resolvedPaidBy = form.paidBy;
    if (parsed.paidByHint) {
      const pLower = parsed.paidByHint.toLowerCase();
      if (displayName.toLowerCase().includes(pLower)) {
        resolvedPaidBy = userId;
      } else if (partner && partner.displayName.toLowerCase().includes(pLower)) {
        resolvedPaidBy = partner.id;
      }
    }

    // 5. Automation rules check
    const members = [
      { id: userId, displayName },
      ...(partner ? [{ id: partner.id, displayName: partner.displayName }] : []),
    ];
    const rule = matchAutomationRule(parsed.itemName, automationRules, {
      amount: parsed.amount,
      entryType: parsed.entryType ?? form.entryType,
    });

    return {
      parsed,
      matchedMerchant,
      matchedCategory,
      resolvedPaymentMethod,
      resolvedCardId,
      resolvedUpiId,
      resolvedBankId,
      resolvedPaidBy,
      rule,
      members,
    };
  };

  // Automatic real-time parsing as the user types or speaks (debounced 120ms)
  useEffect(() => {
    if (!nlEntryOpen || isEditing || !open) return;
    const raw = (typeof nlText === "string" ? nlText : "").trim();
    if (!raw) return;

    const timer = setTimeout(() => {
      const res = resolveNaturalLanguage(raw);
      if (!res) return;
      const { parsed, matchedMerchant, matchedCategory, resolvedPaymentMethod, resolvedCardId, resolvedUpiId, resolvedBankId, resolvedPaidBy, rule, members } = res;

      if (rule) {
        const resolvedRule = resolveRuleActions(rule, categoryTree, merchants, members);
        applyMatchedRule(rule, resolvedRule);
      }

      setForm((f) => ({
        ...f,
        itemName: parsed.itemName || f.itemName,
        amount: parsed.amount !== null ? String(parsed.amount) : f.amount,
        paymentMethod: resolvedPaymentMethod || f.paymentMethod,
        cardId: resolvedCardId ?? f.cardId,
        upiProfileId: resolvedUpiId ?? f.upiProfileId,
        bankAccountId: resolvedBankId ?? f.bankAccountId,
        date: parsed.expenseDate || f.date,
        merchant: matchedMerchant ?? f.merchant,
        category: matchedCategory ?? f.category,
        entryType: parsed.entryType ?? f.entryType,
        expenseType: parsed.expenseTypeHint ?? f.expenseType,
        paidBy: resolvedPaidBy || f.paidBy,
      }));

      if (matchedCategory) setCategoryTouched(true);
      if (parsed.amount !== null) setAmountTouched(true);
    }, 120);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlText, nlEntryOpen, isEditing, open, merchants, incomeCategoryTree, expenseCategoryTree, cards, upiProfiles, bankAccounts, displayName, partner, userId, automationRules, categoryTree]);

  function applyNaturalLanguageEntry(overrideText?: string, showToast = true) {
    const textToParse = typeof overrideText === "string" ? overrideText : nlText;
    if (!textToParse || typeof textToParse !== "string" || !textToParse.trim()) return;
    const res = resolveNaturalLanguage(textToParse);
    if (!res) return;
    const { parsed, matchedMerchant, matchedCategory, resolvedPaymentMethod, resolvedCardId, resolvedUpiId, resolvedBankId, resolvedPaidBy, rule, members } = res;

    if (rule) {
      const resolved = resolveRuleActions(rule, categoryTree, merchants, members);
      applyMatchedRule(rule, resolved);
    }

    setForm((f) => ({
      ...f,
      itemName: parsed.itemName || f.itemName,
      amount: parsed.amount !== null ? String(parsed.amount) : f.amount,
      paymentMethod: resolvedPaymentMethod || f.paymentMethod,
      cardId: resolvedCardId ?? f.cardId,
      upiProfileId: resolvedUpiId ?? f.upiProfileId,
      bankAccountId: resolvedBankId ?? f.bankAccountId,
      date: parsed.expenseDate || f.date,
      merchant: matchedMerchant ?? f.merchant,
      category: matchedCategory ?? f.category,
      entryType: parsed.entryType ?? f.entryType,
      expenseType: parsed.expenseTypeHint ?? f.expenseType,
      paidBy: resolvedPaidBy || f.paidBy,
    }));

    if (matchedCategory) setCategoryTouched(true);
    if (parsed.amount !== null) setAmountTouched(true);

    if (showToast) {
      const parts: string[] = [];
      if (parsed.itemName) parts.push(parsed.itemName);
      if (parsed.amount !== null) parts.push(`₹${parsed.amount}`);
      if (matchedCategory) parts.push(matchedCategory.subcategoryName ?? matchedCategory.categoryName);
      if (matchedMerchant) parts.push(matchedMerchant.name);

      toast.success(parts.length > 0 ? `Smart parsed: ${parts.join(" • ")}` : "Smart parsed - review details");
    }
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
  const voiceTranscriptRef = useRef<string>("");

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
    voiceTranscriptRef.current = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API has no shared TS lib typing across browsers
    const recognition: any = new (SpeechRecognitionCtor as any)();
    recognition.lang = "en-IN"; // English (India) - transcribes speech in English with support for Indian accent and terms
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      toast.error("Didn't catch that - please try again.");
    };
    recognition.onend = () => {
      setListening(false);
      const text = voiceTranscriptRef.current?.trim();
      if (text) {
        applyNaturalLanguageEntry(text, true);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      voiceTranscriptRef.current = transcript;
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
    const rawParsed = nlEntryOpen && nlText.trim() ? parseQuickEntry(nlText) : null;
    const effectiveName = (rawParsed?.itemName || (nlEntryOpen && nlText.trim() ? nlText.trim() : form.itemName)) || "";
    const q = (typeof effectiveName === "string" ? effectiveName : "").trim().toLowerCase();
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
      const parsedAmt = rawParsed?.amount;
      const amt = typeof parsedAmt === "number" && parsedAmt > 0 ? parsedAmt : parseFloat(form.amount);
      if (!amt || amt <= 0) return [];

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
            let topCat = parent ? categoryFlat.find((c) => c.id === parent.id) : null;
            if (!topCat && m.category_id) {
              topCat = categoryFlat.find((c) => c.id === m.category_id) ?? null;
            }

            const isPayout = m.name.toLowerCase().includes("seller payout") || m.name.toLowerCase().includes("website orders") || m.name.toLowerCase().includes("freelance client");
            const defaultCategoryName = isPayout ? "Business Sales & Payouts" : "Shopping";
            const fallbackCat = categoryFlat.find((c) => c.name.toLowerCase() === defaultCategoryName.toLowerCase() && !c.parent_id);

            results.push({
              key,
              itemName: m.name,
              amount: null,
              categoryId: topCat?.id ?? fallbackCat?.id ?? (isPayout ? "seed-business-sales" : "seed-shopping"),
              subcategoryId: sub?.id ?? null,
              categoryName: topCat?.name ?? fallbackCat?.name ?? defaultCategoryName,
              subcategoryName: sub?.name ?? null,
              categoryIcon: topCat?.icon ?? fallbackCat?.icon ?? (isPayout ? "shopping-bag" : "store"),
              categoryColor: topCat?.color ?? fallbackCat?.color ?? "indigo",
              merchant: m,
              paymentMethod: "UPI",
              paidBy: isPayout && partner?.displayName?.toLowerCase().includes("roshni") ? partner.id : userId,
              expenseType: isPayout ? "household" : "household",
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
          let topCat = parent ? categoryFlat.find((c) => c.id === parent.id) : null;
          if (!topCat && m.category_id) {
            topCat = categoryFlat.find((c) => c.id === m.category_id) ?? null;
          }

          const isPayout = m.name.toLowerCase().includes("seller payout") || m.name.toLowerCase().includes("website orders") || m.name.toLowerCase().includes("freelance client");
          const defaultCategoryName = isPayout ? "Business Sales & Payouts" : "Shopping";
          const fallbackCat = categoryFlat.find((c) => c.name.toLowerCase() === defaultCategoryName.toLowerCase() && !c.parent_id);

          results.push({
            key,
            itemName: m.name,
            amount: null,
            categoryId: topCat?.id ?? fallbackCat?.id ?? (isPayout ? "seed-business-sales" : "seed-shopping"),
            subcategoryId: sub?.id ?? null,
            categoryName: topCat?.name ?? fallbackCat?.name ?? defaultCategoryName,
            subcategoryName: sub?.name ?? null,
            categoryIcon: topCat?.icon ?? fallbackCat?.icon ?? (isPayout ? "shopping-bag" : "store"),
            categoryColor: topCat?.color ?? fallbackCat?.color ?? "indigo",
            merchant: m,
            paymentMethod: "UPI",
            paidBy: isPayout && partner?.displayName?.toLowerCase().includes("roshni") ? partner.id : userId,
            expenseType: isPayout ? "household" : "household",
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
              itemName: (typeof form.itemName === "string" ? form.itemName : "").trim(),
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
  }, [form.itemName, form.amount, amountTouched, isEditing, predictionDismissed, pastPredictions, merchants, categoryFlat, userId, partner, nlEntryOpen, nlText]);

  interface PredictiveMatchItem {
    itemName: string;
    amount: number | null;
    categoryId: string;
    subcategoryId: string | null;
    categoryName: string;
    subcategoryName: string | null;
    merchant: Tables<"merchants"> | null;
    paymentMethod?: string | null;
    paidBy?: string | null;
    expenseType?: ExpenseType | null;
  }

  function applyPredictiveMatch(pred: PredictiveMatchItem) {
    const matchedCategory = categoryFlat.find((c) => c.id === pred.categoryId);
    const isIncome =
      matchedCategory?.type === "income" ||
      pred.categoryName.toLowerCase().includes("income") ||
      pred.categoryName.toLowerCase().includes("salary") ||
      pred.categoryName.toLowerCase().includes("business sales") ||
      pred.categoryName.toLowerCase().includes("freelancing");

    setForm((f) => ({
      ...f,
      entryType: isIncome ? "income" : f.entryType,
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
      expenseType: (pred.expenseType as ExpenseType) || f.expenseType,
    }));
    if (nlEntryOpen) {
      setNlText(pred.amount ? `${pred.itemName} ${pred.amount}` : pred.itemName);
    }
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

      if (entryMode === "shopping" && result.data) {
        if (result.data.merchant) {
          const match = merchants.find((m) => m.name.toLowerCase().includes(result.data!.merchant!.toLowerCase()));
          if (match) setTripMerchant(match);
        }
        if (result.data.date) {
          setTripDate(result.data.date);
        }
        if (result.data.items && result.data.items.length > 0) {
          const newRows: ShoppingRow[] = result.data.items.map((it) => {
            const detectedCat = autoDetectCategoryForShopping(it, expenseCategoryTree, categoryFlat);
            const amtStr = (result.data!.items.length === 1 && result.data!.amount)
              ? String(result.data!.amount)
              : "";
            return {
              key: crypto.randomUUID(),
              itemName: it,
              amount: amtStr,
              quantity: "1",
              unitPrice: amtStr,
              unit: "pcs",
              useMultiplier: false,
              category: detectedCat,
              merchant: null,
              expenseType: tripExpenseType,
              notes: "",
              isExpanded: false,
            };
          });
          setShoppingRows(newRows);
          toast.success(`✨ Extracted ${newRows.length} item${newRows.length === 1 ? "" : "s"} from receipt into cart!`);
        } else if (result.data.amount) {
          const detectedCat = autoDetectCategoryForShopping(result.data.categoryGuess || "Grocery", expenseCategoryTree, categoryFlat);
          setShoppingRows([
            {
              key: crypto.randomUUID(),
              itemName: result.data.merchant || "Shopping Receipt",
              amount: String(result.data.amount),
              quantity: "1",
              unitPrice: String(result.data.amount),
              unit: "pcs",
              useMultiplier: false,
              category: detectedCat,
              merchant: null,
              expenseType: tripExpenseType,
              notes: "",
              isExpanded: false,
            },
          ]);
          toast.success(`✨ Receipt amount ₹${result.data.amount} loaded into cart!`);
        }
        return;
      }

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

    if (values.categoryGuess && typeof values.categoryGuess === "string") {
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
        toast.error("Couldn't upload receipt - expense will be saved without it");
        return null;
      }
      return path;
    } catch {
      toast.error("Couldn't upload receipt - expense will be saved without it");
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
    toast.info(`Loaded "${chip.itemName} ₹${chip.amount}" - tap Save Expense when ready`, { duration: 3000 });
  }

  // Quick Add for LuxeKraft incoming sales
  function handleLuxeKraftQuickAdd(chip: (typeof LUXEKRAFT_INCOME_QUICK_CHIPS)[number]) {
    const activeTree = incomeCategoryTree.length > 0 ? incomeCategoryTree : DEFAULT_TOP_INCOME_CATEGORIES;
    const parentCat = activeTree.find(
      (c) => c.name.toLowerCase() === chip.categoryName.toLowerCase()
    );
    const subCat = parentCat?.children?.find(
      (s) => s.name.toLowerCase() === chip.subcategoryName.toLowerCase()
    );

    const luxeKraftMerchant = merchants.find(
      (m) => m.name.toLowerCase() === "luxekraft.shop" || m.name.toLowerCase() === "luxekraft" || m.normalized_name === "luxekraft"
    ) ?? null;

    setForm((f) => ({
      ...f,
      entryType: "income",
      itemName: chip.itemName,
      amount: String(chip.amount),
      category: parentCat
        ? {
            categoryId: parentCat.id,
            subcategoryId: subCat?.id ?? null,
            categoryName: parentCat.name,
            subcategoryName: subCat?.name ?? chip.subcategoryName,
          }
        : null,
      merchant: luxeKraftMerchant,
      paymentMethod: "UPI",
    }));
    setAmountTouched(true);
    setCategoryTouched(true);
    toast.info(`Loaded LuxeKraft sale "${chip.itemName} ₹${chip.amount}" - tap Save Income when ready`, { duration: 3000 });
  }

  // Quick Add for LuxeKraft incoming sales directly into Multi-Order list
  function handleAddLuxeKraftChipToShopping(chip: (typeof LUXEKRAFT_INCOME_QUICK_CHIPS)[number]) {
    const activeTree = incomeCategoryTree.length > 0 ? incomeCategoryTree : DEFAULT_TOP_INCOME_CATEGORIES;
    const parentCat = activeTree.find(
      (c) => c.name.toLowerCase() === chip.categoryName.toLowerCase()
    );
    const subCat = parentCat?.children?.find(
      (s) => s.name.toLowerCase() === chip.subcategoryName.toLowerCase()
    );
    const catSelection: CategorySelection | null = parentCat
      ? {
          categoryId: parentCat.id,
          subcategoryId: subCat?.id ?? null,
          categoryName: parentCat.name,
          subcategoryName: subCat?.name ?? chip.subcategoryName,
        }
      : null;

    const luxeMerchant =
      merchants.find((m) => m.name.toLowerCase() === "luxekraft.shop" || m.name.toLowerCase() === "luxekraft" || m.normalized_name === "luxekraft") ??
      tripMerchant;

    if (!tripMerchant && luxeMerchant) {
      setTripMerchant(luxeMerchant);
    }

    setShoppingRows((prev) => {
      // If only one row and it's empty, replace it
      if (prev.length === 1 && !prev[0].itemName.trim() && !prev[0].amount.trim()) {
        return [
          {
            key: prev[0].key,
            itemName: chip.itemName,
            amount: String(chip.amount),
            quantity: "1",
            unitPrice: String(chip.amount),
            unit: "pcs",
            useMultiplier: false,
            category: catSelection,
            merchant: luxeMerchant,
            expenseType: tripExpenseType,
            notes: "",
            isExpanded: false,
          },
        ];
      }

      // Otherwise append new item
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          itemName: chip.itemName,
          amount: String(chip.amount),
          quantity: "1",
          unitPrice: String(chip.amount),
          unit: "pcs",
          useMultiplier: false,
          category: catSelection,
          merchant: luxeMerchant,
          expenseType: tripExpenseType,
          notes: "",
          isExpanded: false,
        },
      ];
    });

    toast.success(`Added "${chip.itemName}" (₹${chip.amount}) to order`);
  }

  // Handle Single Expense / Income Submit
  async function handleSubmitSingle(opts?: { keepOpen?: boolean }) {
    let currentForm = form;
    if (nlEntryOpen && nlText && nlText.trim()) {
      const res = resolveNaturalLanguage(nlText.trim());
      if (res) {
        const { parsed, matchedMerchant, matchedCategory, resolvedPaymentMethod, resolvedCardId, resolvedUpiId, resolvedBankId, resolvedPaidBy } = res;
        currentForm = {
          ...currentForm,
          itemName: currentForm.itemName || parsed.itemName || nlText.trim(),
          amount: currentForm.amount && parseFloat(currentForm.amount) > 0 ? currentForm.amount : (parsed.amount !== null ? String(parsed.amount) : currentForm.amount),
          paymentMethod: currentForm.paymentMethod || resolvedPaymentMethod || "UPI",
          cardId: currentForm.cardId ?? resolvedCardId,
          upiProfileId: currentForm.upiProfileId ?? resolvedUpiId,
          bankAccountId: currentForm.bankAccountId ?? resolvedBankId,
          date: currentForm.date || parsed.expenseDate,
          merchant: currentForm.merchant ?? matchedMerchant,
          category: currentForm.category ?? matchedCategory,
          entryType: currentForm.entryType || parsed.entryType || "expense",
          expenseType: currentForm.expenseType || parsed.expenseTypeHint || "household",
          paidBy: currentForm.paidBy || resolvedPaidBy,
        };
      }
    }

    if (!currentForm.category) {
      toast.error("Choose a category");
      return;
    }
    const amount = parseFloat(currentForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const cleanItemName = (typeof currentForm.itemName === "string" ? currentForm.itemName : "").trim();
    if (!cleanItemName) {
      toast.error("Enter an item or merchant name");
      return;
    }

    let finalCatId = currentForm.category.categoryId;
    if (finalCatId.startsWith("seed-")) {
      const match = categoryFlat.find((c) => c.name.toLowerCase() === currentForm.category!.categoryName.toLowerCase() && !c.parent_id);
      if (match) finalCatId = match.id;
    }

    setSubmitting(true);
    const payload = {
      amount,
      item_name: cleanItemName,
      category_id: finalCatId,
      subcategory_id: currentForm.category.subcategoryId,
      merchant_id: currentForm.merchant?.id ?? null,
      paid_by: currentForm.paidBy,
      expense_type: currentForm.expenseType,
      entry_type: currentForm.entryType,
      payment_method: currentForm.paymentMethod || "UPI",
      card_id: currentForm.cardId,
      upi_profile_id: currentForm.upiProfileId,
      bank_account_id: currentForm.bankAccountId,
      expense_date: currentForm.date,
      expense_time: currentForm.time ? `${currentForm.time}:00` : null,
      notes: (typeof currentForm.notes === "string" ? currentForm.notes : "").trim() || null,
    };

    if (!isEditing && isOffline()) {
      if (receiptFile) toast.message("Receipt will need to be attached again once back online");
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${payload.item_name} queued - will sync when online`);
      if (!opts?.keepOpen) onOpenChange(false);
      return;
    }

    try {
      const receiptPath = isEditing ? null : await uploadReceiptIfAny();
      const result = isEditing
        ? await updateExpense(editExpense!.id, payload)
        : await createExpense(payload, undefined, receiptPath);
      setSubmitting(false);

      if (result.error !== null) {
        toast.error(result.error, { action: { label: "Retry", onClick: () => handleSubmitSingle(opts) } });
        return;
      }

      if (!isEditing) onOptimisticAdd?.(result.data);
      onSaved?.(result.data);
      if (appliedRule) recordRuleExecution(appliedRule.id, appliedRule.name).catch(() => {});

      if (opts?.keepOpen) {
        setForm((f) => ({
          ...emptySingleState(userId),
          entryType: f.entryType,
          merchant: f.merchant,
          paymentMethod: f.paymentMethod,
          paidBy: f.paidBy,
          date: f.date,
        }));
        setAmountTouched(false);
        setCategoryTouched(false);
        setNlText("");
        setAppliedRule(null);
        lastRuleCheckedText.current = null;
        toast.success(
          currentForm.entryType === "income"
            ? `Logged "${cleanItemName}" (${formatINR(amount)}) · Ready for next order`
            : `Added "${cleanItemName}" (${formatINR(amount)}) · Ready for next`
        );
        return;
      }

      toast.success(
        isEditing
          ? currentForm.entryType === "income" ? "Income updated" : "Expense updated"
          : currentForm.entryType === "income" ? "Income logged" : "Expense added"
      );
      onOpenChange(false);
    } catch (err) {
      setSubmitting(false);
      if (!isEditing && isNetworkError(err)) {
        await queueExpense(payload);
        refreshPendingCount();
        toast.message(`${payload.item_name} queued - will sync when online`);
        if (!opts?.keepOpen) onOpenChange(false);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: () => handleSubmitSingle(opts) } });
      }
    }
  }

  // Shopping Mode Handlers
  function updateShoppingRow(key: string, patch: Partial<ShoppingRow>) {
    setShoppingRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, ...patch };
        if (patch.quantity !== undefined || patch.unitPrice !== undefined || patch.useMultiplier !== undefined) {
          if (updated.useMultiplier) {
            const qty = parseFloat(updated.quantity) || 0;
            const price = parseFloat(updated.unitPrice) || 0;
            updated.amount = qty && price ? (qty * price).toFixed(2).replace(/\.00$/, "") : "";
          }
        }
        return updated;
      })
    );
  }

  function handleShoppingItemNameChange(key: string, name: string) {
    const activeTree = multiEntryType === "income" ? incomeCategoryTree : expenseCategoryTree;
    const detected = autoDetectCategoryForShopping(name, activeTree, categoryFlat, multiEntryType);
    setShoppingRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r;
        return {
          ...r,
          itemName: name,
          category: detected || r.category,
        };
      })
    );
  }

  function addShoppingRow(presetCategory?: CategorySelection | null) {
    const last = shoppingRows[shoppingRows.length - 1];
    setShoppingRows((list) => [
      ...list,
      emptyShoppingRow(presetCategory ?? last?.category ?? null, tripExpenseType, tripMerchant),
    ]);
  }

  function duplicateShoppingRow(key: string) {
    const index = shoppingRows.findIndex((r) => r.key === key);
    if (index === -1) return;
    const target = shoppingRows[index];
    const cloned: ShoppingRow = {
      ...target,
      key: crypto.randomUUID(),
    };
    const newList = [...shoppingRows];
    newList.splice(index + 1, 0, cloned);
    setShoppingRows(newList);
    toast.message("Item duplicated");
  }

  function removeShoppingRow(key: string) {
    setShoppingRows((list) => {
      if (list.length <= 1) {
        return [emptyShoppingRow(null, tripExpenseType, tripMerchant)];
      }
      return list.filter((r) => r.key !== key);
    });
  }

  function clearAllShoppingRows() {
    setShoppingRows([emptyShoppingRow(null, tripExpenseType, tripMerchant)]);
    toast.message("Cart reset");
  }

  function handleBulkPasteImport() {
    if (!bulkPasteText || !bulkPasteText.trim()) {
      toast.error("Please paste or type some items first");
      return;
    }
    const lines = bulkPasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const activeTree = multiEntryType === "income" ? incomeCategoryTree : expenseCategoryTree;
    const parsedRows: ShoppingRow[] = [];
    for (const line of lines) {
      // 1. Multiplier format "Item 2 x 60"
      const multMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:[xX*])\s*₹?\s*(\d+(?:\.\d+)?)\s*$/);
      if (multMatch) {
        const name = multMatch[1].trim().replace(/^[-*•\d+.]\s*/, "");
        const qty = multMatch[2];
        const price = multMatch[3];
        const total = (parseFloat(qty) * parseFloat(price)).toFixed(2).replace(/\.00$/, "");
        const cat = autoDetectCategoryForShopping(name, activeTree, categoryFlat, multiEntryType);
        parsedRows.push({
          key: crypto.randomUUID(),
          itemName: name,
          amount: total,
          quantity: qty,
          unitPrice: price,
          unit: "pcs",
          useMultiplier: true,
          category: cat,
          merchant: tripMerchant,
          expenseType: tripExpenseType,
          notes: "",
          isExpanded: false,
        });
        continue;
      }

      // 2. Quantity with units "Milk 2L 120"
      const unitMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|l|ltr|litre|ml|pack|pcs|pieces|packet)\s+₹?\s*(\d+(?:\.\d+)?)\s*$/i);
      if (unitMatch) {
        const name = unitMatch[1].trim().replace(/^[-*•\d+.]\s*/, "");
        const qty = unitMatch[2];
        const unit = unitMatch[3].toLowerCase();
        const amt = unitMatch[4];
        const cat = autoDetectCategoryForShopping(name, activeTree, categoryFlat, multiEntryType);
        parsedRows.push({
          key: crypto.randomUUID(),
          itemName: `${name} (${qty}${unit})`,
          amount: amt,
          quantity: qty,
          unitPrice: amt,
          unit: unit === "ltr" || unit === "litre" ? "L" : unit,
          useMultiplier: false,
          category: cat,
          merchant: tripMerchant,
          expenseType: tripExpenseType,
          notes: "",
          isExpanded: false,
        });
        continue;
      }

      // 3. Trailing amount "Milk 60"
      const amtMatch = line.match(/^(.+?)(?:[:=-]|\s)+₹?\s*(\d+(?:\.\d+)?)\s*$/);
      if (amtMatch) {
        const name = amtMatch[1].trim().replace(/^[-*•\d+.]\s*/, "");
        const amt = amtMatch[2];
        const cat = autoDetectCategoryForShopping(name, activeTree, categoryFlat, multiEntryType);
        parsedRows.push({
          key: crypto.randomUUID(),
          itemName: name,
          amount: amt,
          quantity: "1",
          unitPrice: amt,
          unit: "pcs",
          useMultiplier: false,
          category: cat,
          merchant: tripMerchant,
          expenseType: tripExpenseType,
          notes: "",
          isExpanded: false,
        });
        continue;
      }

      // 4. Just item name
      const cleanName = line.replace(/^[-*•\d+.]\s*/, "").trim();
      const cat = autoDetectCategoryForShopping(cleanName, activeTree, categoryFlat, multiEntryType);
      parsedRows.push({
        key: crypto.randomUUID(),
        itemName: cleanName,
        amount: "",
        quantity: "1",
        unitPrice: "",
        unit: "pcs",
        useMultiplier: false,
        category: cat,
        merchant: tripMerchant,
        expenseType: tripExpenseType,
        notes: "",
        isExpanded: false,
      });
    }

    if (parsedRows.length > 0) {
      setShoppingRows((prev) => {
        const nonEmptyPrev = prev.filter((r) => r.itemName.trim() || r.amount.trim());
        return [...nonEmptyPrev, ...parsedRows];
      });
      setBulkPasteText("");
      setBulkPasteOpen(false);
      toast.success(`✨ Added ${parsedRows.length} item${parsedRows.length === 1 ? "" : "s"} to ${multiEntryType === "income" ? "order" : "cart"}!`);
    }
  }

  function startShoppingVoiceInput() {
    if (typeof window === "undefined") return;
    interface SpeechEvent {
      results?: Array<Array<{ transcript?: string }>>;
    }
    interface SpeechInstance {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: () => void;
      onresult: (e: SpeechEvent) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechInstance;
      webkitSpeechRecognition?: new () => SpeechInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Voice input is not supported in this browser");
      return;
    }

    if (shoppingListening) {
      if (shoppingSpeechRecRef.current) {
        try {
          shoppingSpeechRecRef.current.stop();
        } catch {}
      }
      setShoppingListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setShoppingListening(true);
        toast.info("🎙️ Speak items (e.g. 'Milk 60, Bread 40, Apples 120')...");
      };

      recognition.onresult = (event: SpeechEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === "string") {
          const parts = transcript
            .split(/,|\band\b|\baur\b|\bane\b|\+/i)
            .map((p: string) => p.trim())
            .filter(Boolean);

          const activeTree = multiEntryType === "income" ? incomeCategoryTree : expenseCategoryTree;
          const newRows: ShoppingRow[] = [];
          for (const part of parts) {
            const amtMatch = part.match(/^(.+?)(?:[:=-]|\s)+₹?\s*(\d+(?:\.\d+)?)\s*$/);
            if (amtMatch) {
              const name = amtMatch[1].trim();
              const amt = amtMatch[2];
              const cat = autoDetectCategoryForShopping(name, activeTree, categoryFlat, multiEntryType);
              newRows.push({
                key: crypto.randomUUID(),
                itemName: name,
                amount: amt,
                quantity: "1",
                unitPrice: amt,
                unit: "pcs",
                useMultiplier: false,
                category: cat,
                merchant: tripMerchant,
                expenseType: tripExpenseType,
                notes: "",
                isExpanded: false,
              });
            } else {
              const cat = autoDetectCategoryForShopping(part, activeTree, categoryFlat, multiEntryType);
              newRows.push({
                key: crypto.randomUUID(),
                itemName: part,
                amount: "",
                quantity: "1",
                unitPrice: "",
                unit: "pcs",
                useMultiplier: false,
                category: cat,
                merchant: tripMerchant,
                expenseType: tripExpenseType,
                notes: "",
                isExpanded: false,
              });
            }
          }

          if (newRows.length > 0) {
            setShoppingRows((prev) => {
              const nonEmptyPrev = prev.filter((r) => r.itemName.trim() || r.amount.trim());
              return [...nonEmptyPrev, ...newRows];
            });
            toast.success(`🎙️ Added ${newRows.length} item${newRows.length === 1 ? "" : "s"} from voice!`);
          }
        }
      };

      recognition.onerror = () => {
        setShoppingListening(false);
      };

      recognition.onend = () => {
        setShoppingListening(false);
      };

      shoppingSpeechRecRef.current = recognition;
      recognition.start();
    } catch {
      setShoppingListening(false);
      toast.error("Couldn't start voice recognition");
    }
  }

  const validShoppingRows = useMemo(() => {
    return shoppingRows.filter((r) => {
      const amt = r.useMultiplier
        ? (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0)
        : parseFloat(r.amount) || 0;
      return r && typeof r.itemName === "string" && r.itemName.trim() && amt > 0 && r.category;
    });
  }, [shoppingRows]);

  const shoppingTotal = useMemo(() => {
    return validShoppingRows.reduce((sum, r) => {
      const amt = r.useMultiplier
        ? (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0)
        : parseFloat(r.amount) || 0;
      return sum + amt;
    }, 0);
  }, [validShoppingRows]);

  const shoppingCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of validShoppingRows) {
      if (row.category) {
        counts[row.category.categoryName] = (counts[row.category.categoryName] || 0) + 1;
      }
    }
    return counts;
  }, [validShoppingRows]);

  async function handleSaveShopping() {
    if (validShoppingRows.length === 0) {
      toast.error("Add at least one item with a name, amount, and category");
      return;
    }
    setSubmitting(true);
    let savedCount = 0;
    const receiptPath = await uploadReceiptIfAny();

    for (const row of validShoppingRows) {
      let finalCatId = row.category!.categoryId;
      if (finalCatId.startsWith("seed-")) {
        const match = categoryFlat.find(
          (c) => c.name.toLowerCase() === row.category!.categoryName.toLowerCase() && !c.parent_id
        );
        if (match) finalCatId = match.id;
      }

      const rowAmt = row.useMultiplier
        ? (parseFloat(row.quantity) || 1) * (parseFloat(row.unitPrice) || 0)
        : parseFloat(row.amount);

      const targetMerchant = row.merchant || tripMerchant;
      let finalMerchantId: string | null = targetMerchant?.id ?? null;
      if (targetMerchant && !targetMerchant.id && targetMerchant.name) {
        const match = merchants.find((m) => m.name.toLowerCase() === targetMerchant.name.toLowerCase());
        if (match) finalMerchantId = match.id;
      }

      const mergedNotes = [tripNotes.trim(), row.notes.trim()].filter(Boolean).join(" · ");

      const result = await createExpense(
        {
          amount: Math.round(rowAmt * 100) / 100,
          item_name: (typeof row.itemName === "string" ? row.itemName : "").trim(),
          category_id: finalCatId,
          subcategory_id: row.category!.subcategoryId,
          merchant_id: finalMerchantId,
          paid_by: tripPaidBy,
          expense_type: row.expenseType || tripExpenseType,
          entry_type: multiEntryType,
          payment_method: tripPaymentMethod,
          card_id: tripCardId,
          upi_profile_id: tripUpiProfileId,
          bank_account_id: tripBankAccountId,
          expense_date: tripDate,
          expense_time: getCurrentISTTime(),
          notes: mergedNotes || null,
        },
        undefined,
        receiptPath
      );

      if (result.error !== null) {
        toast.error(`Stopped after ${savedCount} saved — ${result.error}`);
        setSubmitting(false);
        setShoppingRows((list) =>
          list.filter((r) => !validShoppingRows.slice(0, savedCount).some((saved) => saved.key === r.key))
        );
        return;
      }
      savedCount += 1;
      onSaved?.(result.data);
    }
    setSubmitting(false);
    toast.success(
      multiEntryType === "income"
        ? `🎉 ${savedCount} order item${savedCount === 1 ? "" : "s"} logged · ${formatINR(shoppingTotal)}`
        : `🎉 ${savedCount} item${savedCount === 1 ? "" : "s"} added · ${formatINR(shoppingTotal)}`
    );
    onOpenChange(false);
  }

  const todayIso = getTodayISO();
  const yesterdayIso = addDaysISO(todayIso, -1);

  const isCustomTripDate = tripDate !== todayIso && tripDate !== yesterdayIso;
  const displayTripDateText = useMemo(() => {
    if (isCustomTripDate && tripDate) {
      try {
        const [y, m, d] = tripDate.split("-").map(Number);
        if (y && m && d) {
          const dt = new Date(y, m - 1, d);
          return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
      } catch {
        return tripDate;
      }
    }
    return "Choose date";
  }, [tripDate, isCustomTripDate]);

  const handleOpenTripDatePicker = () => {
    if (tripDateInputRef.current) {
      if (typeof tripDateInputRef.current.showPicker === "function") {
        try {
          tripDateInputRef.current.showPicker();
        } catch {
          tripDateInputRef.current.focus();
        }
      } else {
        tripDateInputRef.current.focus();
      }
    }
  };
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

  // Top 7 categories for 1-tap quick select (never empty, scoped to current entryType)
  const topCategories = useMemo(() => {
    if (form.entryType === "income") {
      if (incomeCategoryTree && incomeCategoryTree.length > 0) {
        return incomeCategoryTree.slice(0, 7);
      }
      return DEFAULT_TOP_INCOME_CATEGORIES;
    }
    if (expenseCategoryTree && expenseCategoryTree.length > 0) {
      return expenseCategoryTree.slice(0, 7);
    }
    return DEFAULT_TOP_CATEGORIES.slice(0, 7);
  }, [form.entryType, incomeCategoryTree, expenseCategoryTree]);

  const multiTopCategories = useMemo(() => {
    if (multiEntryType === "income") {
      if (incomeCategoryTree && incomeCategoryTree.length > 0) {
        return incomeCategoryTree.slice(0, 7);
      }
      return DEFAULT_TOP_INCOME_CATEGORIES;
    }
    if (expenseCategoryTree && expenseCategoryTree.length > 0) {
      return expenseCategoryTree.slice(0, 7);
    }
    return DEFAULT_TOP_CATEGORIES.slice(0, 7);
  }, [multiEntryType, incomeCategoryTree, expenseCategoryTree]);

  const activeShoppingRow = shoppingRows.find((r) => r.key === shoppingCategoryRowKey) ?? null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent showClose={false} className="max-w-lg sm:max-w-xl mx-auto h-[92vh] h-[92dvh] sm:h-auto max-h-[96vh] max-h-[96dvh] flex flex-col focus:outline-none rounded-t-2xl sm:rounded-t-3xl border-t border-border shadow-2xl bg-card">
          {/* Header */}
          <DrawerHeader className="shrink-0 px-4 sm:px-5 pt-3.5 pb-2 border-b border-border/40">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                {entryMode === "shopping" ? (
                  multiEntryType === "income" ? (
                    <>
                      <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Multi-Order / Batch</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Income
                      </span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 text-brand-primary" />
                      <span>Shopping Cart</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                        Multi-Item
                      </span>
                    </>
                  )
                ) : isEditing ? (
                  form.entryType === "income" ? (
                    "Edit Income"
                  ) : (
                    "Edit Expense"
                  )
                ) : form.entryType === "income" ? (
                  "Add Income"
                ) : (
                  "Add Expense"
                )}
              </DrawerTitle>

              <div className="flex items-center gap-1.5">
                {isNewExpense && aiConfigured && (
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
              <div className="mt-2.5 grid grid-cols-2 p-1 bg-muted/80 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("single");
                    setForm((f) => ({ ...f, entryType: multiEntryType }));
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    entryMode === "single"
                      ? "bg-card text-foreground shadow-sm font-bold scale-[1.01]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Zap className="h-3.5 w-3.5 text-brand-primary" />
                  <span>{form.entryType === "income" ? "Single Income" : "Single Expense"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("shopping");
                    setMultiEntryType(form.entryType);
                    if (form.entryType === "income" && !tripMerchant) {
                      const luxe = merchants.find((m) => m.name.toLowerCase() === "luxekraft.shop" || m.name.toLowerCase() === "luxekraft" || m.normalized_name === "luxekraft");
                      if (luxe) setTripMerchant(luxe);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    entryMode === "shopping"
                      ? "bg-card text-foreground shadow-sm font-bold scale-[1.01]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {(form.entryType === "income" && entryMode === "single") || (entryMode === "shopping" && multiEntryType === "income") ? (
                    <ShoppingBag className="h-3.5 w-3.5 text-brand-primary" />
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5 text-brand-primary" />
                  )}
                  <span>
                    {(form.entryType === "income" && entryMode === "single") || (entryMode === "shopping" && multiEntryType === "income")
                      ? "Multi-Order / Batch"
                      : "Shopping Cart (Multi)"}
                  </span>
                </button>
              </div>
            )}

            <DrawerDescription className="sr-only">Enter expense amount, item name, and details</DrawerDescription>
          </DrawerHeader>

          {/* SINGLE EXPENSE MODE BODY */}
          {entryMode === "single" ? (
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3.5 overscroll-contain">
              {/* Expense / Income toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => (f.entryType === "expense" ? f : { ...f, entryType: "expense", category: null }))}
                  className={cn(
                    "min-h-10 rounded-xl border py-2 text-xs font-bold transition-colors",
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
                    "min-h-10 rounded-xl border py-2 text-xs font-bold transition-colors",
                    form.entryType === "income"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Income
                </button>
              </div>

              {/* Quick Add Bar: LuxeKraft 1-Tap Quick Add in Income mode, recent chips in Expense mode */}
              {form.entryType === "income" ? (
                <div className="rounded-xl border border-brand-primary/20 bg-brand-mint/40 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1">
                      <Zap className="h-3 w-3 fill-current" /> LuxeKraft 1-Tap Quick Add
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground">Tap to auto-fill sale</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {LUXEKRAFT_INCOME_QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip.itemName}
                        type="button"
                        onClick={() => handleLuxeKraftQuickAdd(chip)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-brand-primary hover:text-white shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span>{chip.itemName}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatINR(chip.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : quickAddChips && quickAddChips.length > 0 ? (
                <QuickAddBar chips={quickAddChips} onPick={handleQuickAddPick} />
              ) : null}

              {/* Item / Smart Parse Input Section (Front & Center for quick entry) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="item-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    {nlEntryOpen && <Sparkles className="h-3.5 w-3.5 text-brand-primary animate-pulse" />}
                    {nlEntryOpen ? "Smart Parse (Auto-Detect)" : "Item / Description"}
                  </Label>
                  {!isEditing && (
                    <div className="flex items-center gap-2.5">
                      {voiceSupported && (
                        <button
                          type="button"
                          onClick={startVoiceInput}
                          title={listening ? "Stop listening" : "Speak your expense (Gujarati / English)"}
                          aria-label={listening ? "Stop listening" : "Speak your expense"}
                          className={cn(
                            "flex min-h-8 items-center justify-center gap-1 px-1.5 text-xs font-semibold hover:underline",
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
                        onClick={() => {
                          if (nlEntryOpen) {
                            if (nlText.trim()) applyNaturalLanguageEntry();
                            setNlEntryOpen(false);
                          } else {
                            if (form.itemName && !nlText) setNlText(form.itemName);
                            setNlEntryOpen(true);
                          }
                        }}
                        className="text-xs text-brand-primary flex items-center gap-1 hover:underline font-semibold"
                      >
                        <Sparkles className="h-3 w-3" />
                        {nlEntryOpen ? "Manual mode" : "Smart parse"}
                      </button>
                    </div>
                  )}
                </div>

                {nlEntryOpen ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        enterKeyHint="done"
                        value={nlText}
                        onChange={(e) => setNlText(e.target.value)}
                        onBlur={() => {
                          if (nlText.trim()) {
                            applyNaturalLanguageEntry(nlText, false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLElement).blur();
                            applyNaturalLanguageEntry(nlText, true);
                          }
                        }}
                        placeholder='e.g. "Milk 60", "Zudio 1.5k card", "Petrol 500 yesterday"'
                        className="w-full text-base sm:text-sm h-11 bg-background ring-1 ring-brand-primary/20 focus:ring-brand-primary pr-8"
                      />
                      {nlText && (
                        <button
                          type="button"
                          onClick={() => {
                            setNlText("");
                            setForm((f) => ({ ...f, itemName: "", amount: "" }));
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                          title="Clear text"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => applyNaturalLanguageEntry(nlText, true)}
                      disabled={!nlText || typeof nlText !== "string" || !nlText.trim()}
                      className="h-11 px-3.5 font-semibold text-xs shrink-0"
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
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
                      className="flex-1 text-base sm:text-sm h-11 bg-background"
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

                {/* Live Auto-Detected Feedback Pills */}
                {nlEntryOpen && nlText.trim() && (form.itemName || form.amount || form.category) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-brand-mint/40 border border-brand-primary/15 text-xs animate-in fade-in duration-150">
                    <span className="text-[11px] font-bold text-brand-primary flex items-center gap-1 shrink-0">
                      <Sparkles className="h-3 w-3" /> Auto-detected:
                    </span>
                    {form.itemName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-border/60 font-semibold text-foreground">
                        {form.itemName}
                      </span>
                    )}
                    {form.amount && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary font-bold">
                        ₹{form.amount}
                      </span>
                    )}
                    {form.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-border/60 text-foreground font-medium">
                        {form.category.subcategoryName ? `${form.category.categoryName} → ${form.category.subcategoryName}` : form.category.categoryName}
                      </span>
                    )}
                    {form.paymentMethod && form.paymentMethod !== "UPI" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground">
                        {form.paymentMethod}
                      </span>
                    )}
                    {isCustomDate && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground">
                        {displayDateText}
                      </span>
                    )}
                  </div>
                )}

                {/* Real-time Predictive Autocomplete Suggestions (Live as you type) */}
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

              {/* Amount Input Section */}
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
                  <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-brand-mint/60 border border-brand-primary/15 px-3 py-1.5 text-xs text-brand-primary">
                    <span>
                      Last: {formatINR(priceMemory.last)} · Typical: {formatINR(priceMemory.typicalLow)}-{formatINR(priceMemory.typicalHigh)}
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

              {appliedRule && (
                <div className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 w-fit">
                  ✨ Auto-filled by rule: {appliedRule.name}
                </div>
              )}

              {/* 1-Tap Category Quick Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
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
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                            ? "ring-2 ring-brand-primary/30 ring-offset-1 scale-[1.04] shadow font-bold"
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
            /* ENTERPRISE SHOPPING / MULTI-ITEM & MULTI-ORDER MODE BODY */
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-4 overscroll-contain">
              {/* Expense / Income toggle for Multi Mode */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMultiEntryType("expense");
                    setForm((f) => ({ ...f, entryType: "expense" }));
                  }}
                  className={cn(
                    "min-h-10 rounded-xl border py-2 text-xs font-bold transition-colors",
                    multiEntryType === "expense"
                      ? "border-destructive bg-destructive/10 text-destructive shadow-xs font-extrabold"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Expense Cart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMultiEntryType("income");
                    setForm((f) => ({ ...f, entryType: "income" }));
                    if (!tripMerchant) {
                      const luxe = merchants.find((m) => m.name.toLowerCase() === "luxekraft.shop" || m.name.toLowerCase() === "luxekraft" || m.normalized_name === "luxekraft");
                      if (luxe) setTripMerchant(luxe);
                    }
                  }}
                  className={cn(
                    "min-h-10 rounded-xl border py-2 text-xs font-bold transition-colors",
                    multiEntryType === "income"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs font-extrabold"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Income (Multi-Order)
                </button>
              </div>

              {/* LuxeKraft 1-Tap Quick Add into Order List when in Income Multi Mode */}
              {multiEntryType === "income" && (
                <div className="rounded-xl border border-brand-primary/20 bg-brand-mint/40 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1">
                      <Zap className="h-3 w-3 fill-current" /> LuxeKraft 1-Tap Quick Add to Order
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground">Tap chip to append item</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {LUXEKRAFT_INCOME_QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip.itemName}
                        type="button"
                        onClick={() => handleAddLuxeKraftChipToShopping(chip)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-brand-primary hover:text-white shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span>{chip.itemName}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatINR(chip.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trip / Order Defaults & Store Header Card */}
              <div className="rounded-2xl border border-border/80 bg-muted/40 p-3.5 space-y-3 shadow-xs">
                {/* Store / Merchant / Channel Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-brand-primary" />
                      {multiEntryType === "income" ? "Channel / Order Source" : "Store / Merchant"}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShoppingMerchantPickerTarget("trip")}
                      className="text-xs font-semibold text-brand-primary flex items-center gap-0.5 hover:underline"
                    >
                      {tripMerchant
                        ? multiEntryType === "income" ? "Change source" : "Change store"
                        : multiEntryType === "income" ? "Browse sources" : "Browse all stores"}{" "}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Selected Merchant Active Pill or Quick Store/Source Chips */}
                  {tripMerchant ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-mint/60 border border-brand-primary/30 text-xs">
                      <div className="flex items-center gap-2 font-bold text-brand-primary">
                        <Store className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{tripMerchant.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold">
                          {multiEntryType === "income" ? "Order Source" : "Trip Merchant"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTripMerchant(null)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                        title="Clear source"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(multiEntryType === "income" ? COMMON_INCOME_SOURCE_NAMES : COMMON_SHOPPING_MERCHANT_NAMES).map((mName) => (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            const found = merchants.find((m) => m.name.toLowerCase() === mName.toLowerCase());
                            setTripMerchant(
                              found ||
                                ({
                                  id: `temp-${mName}`,
                                  name: mName,
                                  household_id: householdId,
                                  created_at: "",
                                  is_active: true,
                                } as Tables<"merchants">)
                            );
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold border border-border/70 bg-card text-foreground hover:bg-brand-mint/40 hover:border-brand-primary/40 transition-all shadow-2xs active:scale-95"
                        >
                          {mName}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShoppingMerchantPickerTarget("trip")}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      >
                        {multiEntryType === "income" ? "+ Other source…" : "+ Other store…"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Summary Pill Bar & Collapsible Trip Details Toggle */}
                <div className="pt-1 border-t border-border/40 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border/60 font-semibold text-foreground">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {displayTripDateText}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border/60 font-semibold text-foreground">
                      <Smartphone className="h-3 w-3 text-muted-foreground" />
                      {tripPaymentMethod || "No payment method"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border/60 font-semibold text-foreground capitalize">
                      {tripExpenseType} · {tripPaidBy === userId ? (multiEntryType === "income" ? "Received by Me" : "Me") : (partner?.displayName || "Partner")}
                    </span>
                    {receiptFile && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-mint border border-brand-primary/20 text-brand-primary font-semibold">
                        <Paperclip className="h-3 w-3" /> Receipt attached
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTripSettings((prev) => !prev)}
                    className="text-xs font-bold text-brand-primary flex items-center gap-1 hover:underline shrink-0 ml-2"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>
                      {showTripSettings
                        ? "Hide details"
                        : multiEntryType === "income"
                          ? "Order details"
                          : "Trip details"}
                    </span>
                    {showTripSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {/* Expanded Trip Settings Controls */}
                {showTripSettings && (
                  <div className="pt-3 border-t border-border/60 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Payment Method Selection */}
                    <div>
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Payment Method
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_PAYMENT_METHODS.map((m) => {
                          const isSelected = tripPaymentMethod === m.id;
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setTripPaymentMethod(isSelected ? null : m.id);
                                setTripCardId(null);
                                setTripUpiProfileId(null);
                                setTripBankAccountId(null);
                              }}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                                isSelected
                                  ? "bg-brand-primary text-white border-brand-primary shadow-sm ring-2 ring-brand-primary/20"
                                  : "bg-background text-foreground border-border/60 hover:bg-muted"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Payment Instrument Sub-Pickers */}
                      {(tripPaymentMethod === "Credit Card" || tripPaymentMethod === "Debit Card") && cards.length > 0 && (
                        <div className="mt-2">
                          <CardQuickPicker cards={cards} value={tripCardId} onChange={setTripCardId} />
                        </div>
                      )}
                      {tripPaymentMethod === "UPI" && upiProfiles.length > 0 && (
                        <div className="mt-2">
                          <UpiQuickPicker profiles={upiProfiles} value={tripUpiProfileId} onChange={setTripUpiProfileId} />
                        </div>
                      )}
                      {tripPaymentMethod === "Bank Transfer" && bankAccounts.length > 0 && (
                        <div className="mt-2">
                          <BankQuickPicker accounts={bankAccounts} value={tripBankAccountId} onChange={setTripBankAccountId} />
                        </div>
                      )}
                    </div>

                    {/* Date Picker */}
                    <div>
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        {multiEntryType === "income" ? "Date of Order" : "Date of Purchase"}
                      </Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setTripDate(todayIso)}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                            tripDate === todayIso
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                              : "bg-background text-foreground border-border/60 hover:bg-muted"
                          )}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setTripDate(yesterdayIso)}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                            tripDate === yesterdayIso
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                              : "bg-background text-foreground border-border/60 hover:bg-muted"
                          )}
                        >
                          Yesterday
                        </button>
                        <div className="relative inline-flex items-center">
                          <button
                            type="button"
                            onClick={handleOpenTripDatePicker}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                              isCustomTripDate
                                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                : "bg-background text-foreground border-border/60 hover:bg-muted"
                            )}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{displayTripDateText}</span>
                          </button>
                          <input
                            ref={tripDateInputRef}
                            type="date"
                            value={tripDate}
                            onChange={(e) => {
                              if (e.target.value) setTripDate(e.target.value);
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                            aria-label="Pick custom date"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Paid By & Expense Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          {multiEntryType === "income" ? "Received By" : "Paid By"}
                        </Label>
                        <PaidBySelector value={tripPaidBy} onChange={setTripPaidBy} />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          {multiEntryType === "income" ? "Entry Scope" : "Expense Type"}
                        </Label>
                        <ExpenseTypeSelector value={tripExpenseType} onChange={setTripExpenseType} />
                      </div>
                    </div>

                    {/* Trip Notes */}
                    <div>
                      <Label htmlFor="trip-notes" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        {multiEntryType === "income" ? "Order / Batch Notes (Optional)" : "Trip Notes (Optional)"}
                      </Label>
                      <Input
                        id="trip-notes"
                        value={tripNotes}
                        onChange={(e) => setTripNotes(e.target.value)}
                        placeholder={
                          multiEntryType === "income"
                            ? "e.g. Order #104 · Priya Sharma, or Daily Batch Sep 22"
                            : "e.g. Monthly grocery restock, DMart haul"
                        }
                        className="h-9 text-xs bg-background"
                      />
                    </div>

                    {/* Receipt Status & Delete */}
                    {receiptFile && (
                      <div className="flex items-center justify-between rounded-xl bg-brand-mint/60 border border-brand-primary/20 px-3 py-1.5 text-xs text-brand-primary">
                        <span className="flex items-center gap-2 font-semibold truncate">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          {receiptFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReceiptFile(null)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Power Tools Toolbar */}
              <div className="flex items-center justify-between gap-2 p-1 bg-muted/50 rounded-xl border border-border/50">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addShoppingRow()}
                    className="h-8 px-2.5 text-xs font-bold gap-1 text-brand-primary hover:bg-brand-mint/60 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkPasteOpen((v) => !v)}
                    className={cn(
                      "h-8 px-2.5 text-xs font-semibold gap-1 rounded-lg transition-colors",
                      bulkPasteOpen ? "bg-brand-primary text-white hover:bg-brand-primary/90" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ListPlus className="h-3.5 w-3.5" /> Bulk Paste
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startShoppingVoiceInput}
                    className={cn(
                      "h-8 px-2.5 text-xs font-semibold gap-1 rounded-lg transition-colors",
                      shoppingListening ? "bg-destructive text-white animate-pulse" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {shoppingListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    <span>{shoppingListening ? "Listening…" : "Voice"}</span>
                  </Button>
                  {aiConfigured && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => receiptScanInputRef.current?.click()}
                      disabled={scanning}
                      className="h-8 px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                      {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                      <span>Scan</span>
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllShoppingRows}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive rounded-lg"
                  title="Reset Cart"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Smart Bulk Paste Panel */}
              {bulkPasteOpen && (
                <div className="p-3 rounded-2xl bg-card border border-brand-primary/30 shadow-md space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                      Smart Multi-Line Paste / Quick Entry
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkPasteOpen(false)}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {multiEntryType === "income"
                      ? "Paste lines with item name and price/quantity. GharKharch auto-assigns LuxeKraft & income categories automatically!"
                      : "Paste lines with item name and amount/multiplier. GharKharch auto-detects quantities and assigns categories automatically!"}
                  </p>
                  <textarea
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                    placeholder={
                      multiEntryType === "income"
                        ? "Kashmiri Watch 3 x 499\nOnly Sling Chain 2 x 699\nMacramé Mobile Sling 399"
                        : "Amul Milk 2L 120\nEggs 12 110\nBread 45\nBananas 60\nSurf Excel 220"
                    }
                    rows={4}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkPasteOpen(false)}
                      className="h-8 text-xs font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleBulkPasteImport}
                      className="h-8 text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      {multiEntryType === "income" ? "Import to Order" : "Import to Cart"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Line Items List */}
              <div className="space-y-3">
                {shoppingRows.map((row, index) => {
                  const rowAmt = row.useMultiplier
                    ? (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0)
                    : parseFloat(row.amount) || 0;
                  const swatch = row.category ? colorSwatch(row.category.categoryName) : null;
                  const CatIcon = row.category ? getIcon("shopping-bag") : Layers;

                  return (
                    <div
                      key={row.key}
                      className="rounded-2xl border border-border/80 bg-card p-3 shadow-xs space-y-2.5 transition-all hover:border-brand-primary/30"
                    >
                      {/* Item Row Top: Counter, Name Input, Badges, Actions */}
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                          {index + 1}
                        </span>

                        <div className="relative flex-1">
                          <Input
                            value={row.itemName}
                            onChange={(e) => handleShoppingItemNameChange(row.key, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addShoppingRow(row.category);
                              }
                            }}
                            placeholder={
                              multiEntryType === "income"
                                ? "Product / Item (e.g. Kashmiri Watch)"
                                : "Item name (e.g. Amul Milk, Eggs, Rice 5kg)"
                            }
                            className="h-9 text-sm bg-background font-medium"
                          />
                        </div>

                        {/* Duplicate Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateShoppingRow(row.key)}
                          title="Duplicate item"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>

                        {/* Expand Row Settings Toggle */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => updateShoppingRow(row.key, { isExpanded: !row.isExpanded })}
                          title="More item details"
                          className={cn(
                            "h-8 w-8 shrink-0 rounded-lg transition-colors",
                            row.isExpanded ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete Row Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeShoppingRow(row.key)}
                          title="Remove item"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Item Row Middle: Category Button + Amount / Multiplier Controls */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {/* Category Selector Button */}
                        <button
                          type="button"
                          onClick={() => setShoppingCategoryRowKey(row.key)}
                          style={swatch ? { backgroundColor: swatch.bg, color: swatch.fg, borderColor: swatch.fg + "33" } : undefined}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold max-w-[55%] truncate transition-all text-left shadow-2xs",
                            row.category
                              ? "hover:opacity-90"
                              : "bg-muted text-muted-foreground border-border/70 hover:bg-muted/80"
                          )}
                        >
                          <CatIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {row.category
                              ? `${row.category.categoryName}${row.category.subcategoryName ? ` · ${row.category.subcategoryName}` : ""}`
                              : "Choose category"}
                          </span>
                          <ChevronRight className="h-3 w-3 shrink-0 opacity-70 ml-auto" />
                        </button>

                        {/* Amount or Multiplier Stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Multiplier Toggle Button */}
                          <button
                            type="button"
                            onClick={() => updateShoppingRow(row.key, { useMultiplier: !row.useMultiplier })}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition-colors",
                              row.useMultiplier
                                ? "bg-brand-primary text-white border-brand-primary shadow-2xs"
                                : "bg-muted text-muted-foreground border-border/60 hover:text-foreground"
                            )}
                            title={row.useMultiplier ? "Switch to Flat Amount" : "Switch to Quantity x Price Multiplier"}
                          >
                            <Calculator className="h-3.5 w-3.5" />
                          </button>

                          {row.useMultiplier ? (
                            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70 text-xs">
                              <Input
                                value={row.quantity}
                                onChange={(e) => updateShoppingRow(row.key, { quantity: e.target.value.replace(/[^0-9.]/g, "") })}
                                placeholder="Qty"
                                inputMode="decimal"
                                className="h-7 w-12 text-center font-bold text-xs bg-background p-1"
                              />
                              <select
                                value={row.unit}
                                onChange={(e) => updateShoppingRow(row.key, { unit: e.target.value })}
                                className="h-7 rounded-md border border-border bg-background px-1 text-[11px] font-semibold text-foreground focus:outline-none"
                              >
                                {SHOPPING_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                              <span className="text-muted-foreground font-semibold">@</span>
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                                <Input
                                  value={row.unitPrice}
                                  onChange={(e) => updateShoppingRow(row.key, { unitPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                                  placeholder="0"
                                  inputMode="decimal"
                                  className="h-7 w-16 pl-4 pr-1 text-right font-bold text-xs bg-background"
                                />
                              </div>
                              <span className="font-bold text-foreground font-mono ml-1 px-1.5 py-0.5 rounded bg-card border border-border/50">
                                {formatINR(rowAmt)}
                              </span>
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                              <Input
                                value={row.amount}
                                onChange={(e) => updateShoppingRow(row.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                                inputMode="decimal"
                                placeholder="0"
                                className="h-8 w-24 pl-5 text-right font-bold text-sm bg-background font-mono"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded Row-Specific Details (Override store, expense type, or per-item note) */}
                      {row.isExpanded && (
                        <div className="pt-2.5 border-t border-border/50 space-y-2 bg-muted/20 p-2 rounded-xl text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                Store Override
                              </Label>
                              <button
                                type="button"
                                onClick={() => setShoppingMerchantPickerTarget(row.key)}
                                className="flex h-7 w-full items-center justify-between rounded-lg border border-border bg-background px-2 text-left text-xs text-foreground hover:bg-muted"
                              >
                                <span className="truncate">{row.merchant?.name || tripMerchant?.name || "Trip default"}</span>
                                <Store className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                              </button>
                            </div>

                            <div>
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                Expense Type
                              </Label>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateShoppingRow(row.key, { expenseType: "household" })}
                                  className={cn(
                                    "h-7 rounded-lg border text-[11px] font-bold transition-colors",
                                    row.expenseType === "household"
                                      ? "bg-brand-primary text-white border-brand-primary"
                                      : "bg-background text-muted-foreground border-border"
                                  )}
                                >
                                  Household
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateShoppingRow(row.key, { expenseType: "personal" })}
                                  className={cn(
                                    "h-7 rounded-lg border text-[11px] font-bold transition-colors",
                                    row.expenseType === "personal"
                                      ? "bg-brand-primary text-white border-brand-primary"
                                      : "bg-background text-muted-foreground border-border"
                                  )}
                                >
                                  Personal
                                </button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                              Item Note (Optional)
                            </Label>
                            <Input
                              value={row.notes}
                              onChange={(e) => updateShoppingRow(row.key, { notes: e.target.value })}
                              placeholder="e.g. For guests, 20% discount"
                              className="h-7 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Another Item Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addShoppingRow()}
                  className="w-full h-11 border-dashed border-2 gap-2 text-xs font-bold hover:border-brand-primary hover:text-brand-primary bg-card"
                >
                  <Plus className="h-4 w-4" /> Add another item
                </Button>
              </div>

              {/* Quick Category Add Row */}
              <div className="pt-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  1-Tap Quick Add By Category:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {multiTopCategories.slice(0, 6).map((cat) => {
                    const swatch = colorSwatch(cat.color);
                    const Icon = getIcon(cat.icon);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          addShoppingRow({
                            categoryId: cat.id,
                            subcategoryId: null,
                            categoryName: cat.name,
                            subcategoryName: null,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-card text-foreground hover:bg-muted transition-all shadow-2xs"
                      >
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                          style={{ color: swatch.fg }}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                        <span>+ {cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Action */}
          <DrawerFooter className="shrink-0 px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] border-t border-border/40 bg-card">
            {entryMode === "single" ? (
              isNewExpense ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 text-sm font-bold border-brand-primary/30 text-brand-primary hover:bg-brand-mint/40 rounded-xl"
                    onClick={() => handleSubmitSingle({ keepOpen: true })}
                    loading={submitting}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Save & Add Next
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 text-base font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md rounded-xl"
                    onClick={() => handleSubmitSingle({ keepOpen: false })}
                    loading={submitting}
                  >
                    {form.entryType === "income" ? "Save Income" : "Save Expense"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md rounded-xl"
                  onClick={() => handleSubmitSingle({ keepOpen: false })}
                  loading={submitting}
                >
                  Save changes
                </Button>
              )
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">
                      {validShoppingRows.length} item{validShoppingRows.length === 1 ? "" : "s"} ready
                    </span>
                    {Object.keys(shoppingCategoryCounts).length > 0 && (
                      <span className="text-[11px] text-muted-foreground/80">
                        ({Object.entries(shoppingCategoryCounts)
                          .map(([cat, count]) => `${count} ${cat}`)
                          .slice(0, 2)
                          .join(", ")}
                        {Object.keys(shoppingCategoryCounts).length > 2 ? "…" : ""})
                      </span>
                    )}
                  </div>
                  <span className="text-base font-extrabold text-foreground font-mono">
                    Total: {formatINR(shoppingTotal)}
                  </span>
                </div>
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md rounded-xl"
                  onClick={handleSaveShopping}
                  disabled={submitting || validShoppingRows.length === 0}
                  loading={submitting}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {multiEntryType === "income"
                    ? `Save all orders ${validShoppingRows.length > 0 ? `(${validShoppingRows.length} items · ${formatINR(shoppingTotal)})` : ""}`
                    : `Save all ${validShoppingRows.length > 0 ? `(${validShoppingRows.length} items · ${formatINR(shoppingTotal)})` : ""}`}
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

      {/* Category Picker for Shopping Rows - dynamically scoped to multiEntryType */}
      <CategoryPicker
        open={!!shoppingCategoryRowKey}
        onOpenChange={(op) => !op && setShoppingCategoryRowKey(null)}
        tree={multiEntryType === "income" ? incomeCategoryTree : expenseCategoryTree}
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

      {/* Unified Merchant Picker (Single mode, Shopping Trip default, or Row Override) */}
      <MerchantPicker
        open={merchantPickerOpen || !!shoppingMerchantPickerTarget}
        onOpenChange={(op) => {
          if (!op) {
            setMerchantPickerOpen(false);
            setShoppingMerchantPickerTarget(null);
          }
        }}
        merchants={merchants}
        loading={merchantsLoading}
        onSelect={(m) => {
          if (shoppingMerchantPickerTarget === "trip") {
            setTripMerchant(m);
            setShoppingMerchantPickerTarget(null);
          } else if (shoppingMerchantPickerTarget) {
            updateShoppingRow(shoppingMerchantPickerTarget, { merchant: m });
            setShoppingMerchantPickerTarget(null);
          } else {
            applyMerchant(m);
          }
        }}
        onMerchantCreated={(m) => {
          setMerchants((list) => [...list, m]);
          setClientCachedData("merchants_list", [...merchants, m]);
          if (shoppingMerchantPickerTarget === "trip") {
            setTripMerchant(m);
            setShoppingMerchantPickerTarget(null);
          } else if (shoppingMerchantPickerTarget) {
            updateShoppingRow(shoppingMerchantPickerTarget, { merchant: m });
            setShoppingMerchantPickerTarget(null);
          }
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
