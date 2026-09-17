"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Store, Sparkles, Paperclip, ScanLine, Loader2, X } from "lucide-react";
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
import { PaymentMethodSelect, CardQuickPicker, UpiQuickPicker, BankQuickPicker } from "@/components/expenses/payment-method-select";
import { DateTimeFields, MoreOptionsDisclosure, NotesField } from "@/components/expenses/date-time-fields";
import { QuickAddBar } from "@/components/shared/quick-add-bar";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO } from "@/lib/date-utils";
import { createExpense, updateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { listPaymentMethodsForHousehold } from "@/lib/actions/payment-methods";
import { listUserCards, listUpiProfiles, listBankAccounts } from "@/lib/actions/payment-instruments";
import { getQuickAddChips, type QuickAddChip } from "@/lib/actions/quick-add";
import { getCategorySuggestion } from "@/lib/actions/intelligence";
import { getItemPriceMemory, type ItemPriceMemory } from "@/lib/actions/insights";
import type { CategorySuggestion } from "@/lib/expense-intelligence/category-suggester";
import { suggestMerchant } from "@/lib/expense-intelligence/merchant-suggester";
import { isOffline, isNetworkError, queueExpense } from "@/lib/offline/offline-queue";
import { useOffline } from "@/lib/context/offline-context";
import { useQuickAddSave } from "@/lib/hooks/use-quick-add-save";
import { parseQuickEntry } from "@/lib/expense-intelligence/nl-parser";
import { detectPriceChange, type PriceChangeFlag } from "@/lib/actions/insights";
import { ReceiptReviewSheet, type ReceiptReviewValues } from "@/components/shared/receipt-review-sheet";
import { checkAiConfigured, scanReceipt } from "@/lib/actions/receipts";
import type { ParsedReceipt } from "@/lib/ai/receipt-parser";
import { createClient } from "@/lib/supabase/client";
import type { Tables, ExpenseType } from "@/types/database";
import { formatINR } from "@/lib/utils";

interface AddExpenseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: EnrichedExpense | null;
  duplicateFrom?: EnrichedExpense | null;
  onOptimisticAdd?: (expense: Tables<"expenses">) => void;
  onSaved?: (expense: Tables<"expenses">) => void;
  /** Switches to the "Shopping mode" sheet instead (spec section 1) — only offered from the global sheet instance (add-expense-context.tsx), not the Expenses screen's own edit-only instance. Placement: a small text link in the header, next to the title, visible only for a brand-new expense (not while editing/duplicating) since shopping mode is itself a way to *start* several new expenses, not an edit action. */
  onOpenShoppingMode?: () => void;
}

function emptyState(userId: string) {
  return {
    amount: "",
    itemName: "",
    merchant: null as Tables<"merchants"> | null,
    category: null as CategorySelection | null,
    paidBy: userId,
    expenseType: "household" as ExpenseType,
    date: getTodayISO(),
    time: "",
    paymentMethod: null as string | null,
    cardId: null as string | null,
    upiProfileId: null as string | null,
    bankAccountId: null as string | null,
    notes: "",
  };
}

export function AddExpenseSheet({ open, onOpenChange, editExpense, duplicateFrom, onOptimisticAdd, onSaved, onOpenShoppingMode }: AddExpenseSheetProps) {
  const { userId, householdId } = useHousehold();
  const { refreshPendingCount } = useOffline();
  const isEditing = !!editExpense;

  const [form, setForm] = useState(() => emptyState(userId));
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [categoryFlat, setCategoryFlat] = useState<Tables<"categories">[]>([]);
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Tables<"payment_methods">[]>([]);
  const [cards, setCards] = useState<Tables<"user_cards">[]>([]);
  const [upiProfiles, setUpiProfiles] = useState<Tables<"upi_profiles">[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [quickAddChips, setQuickAddChips] = useState<QuickAddChip[]>([]);

  useEffect(() => {
    if (!open) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the reference-data fetch when the sheet opens
    setLoadingRefs(true);
    Promise.all([
      listCategoriesForHousehold(),
      listMerchantsForHousehold(),
      listPaymentMethodsForHousehold(),
      listUserCards(),
      listUpiProfiles(),
      listBankAccounts(),
      getQuickAddChips(),
    ]).then(([cats, merch, methods, userCards, upi, banks, chips]) => {
      if (cats.data) {
        setCategoryTree(cats.data.tree);
        setCategoryFlat(cats.data.flat);
      }
      if (merch.data) setMerchants(merch.data);
      if (methods.data) setPaymentMethods(methods.data);
      if (userCards.data) setCards(userCards.data);
      if (upi.data) setUpiProfiles(upi.data);
      if (banks.data) setBankAccounts(banks.data);
      if (chips.data) setQuickAddChips(chips.data);
      setLoadingRefs(false);
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
        paymentMethod: source.payment_method,
        cardId: source.card_id,
        upiProfileId: source.upi_profile_id,
        bankAccountId: source.bank_account_id,
        notes: source.notes ?? "",
      });
      setCategoryTouched(true);
      setAmountTouched(true);
    } else {
      setForm(emptyState(userId));
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
  const isNewExpense = !isEditing && !duplicateFrom;

  // Receipt attach/scan (spec section 3) — attach-only support is limited to
  // a brand-new expense (not edit/duplicate): editing an existing expense's
  // receipt is a reasonable future addition, but out of this phase's scope,
  // and keeping it new-expense-only avoids a half-finished "replace receipt"
  // flow. `receiptFile` backs BOTH entry points — a receipt picked through
  // "Scan receipt" is also attached as the expense's receipt image, since the
  // person already has the photo in hand; "Attach receipt" alone never calls
  // any AI.
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

  // "Same as last time" amount memory (smart amount suggestion): debounced,
  // same pattern as the category suggestion effect below. Only offered for a
  // brand-new expense, and only while the person hasn't touched the amount
  // field themselves yet — the suggestion never fills the field on its own.
  useEffect(() => {
    if (!isNewExpense || amountTouched || !open || !form.itemName.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale suggestion once its inputs no longer apply
      setPriceMemory(null);
      setPriceChange(null);
      return;
    }
    const itemName = form.itemName;
    const timer = setTimeout(() => {
      getItemPriceMemory(itemName).then((result) => {
        if (result.error === null) setPriceMemory(result.data);
      });
      // Price-change detection (spec 2b) piggybacks on the same debounce as
      // the amount-memory suggestion rather than adding a second network
      // round trip on every keystroke — it's shown as a small, subtle note
      // inside that existing suggestion row (see below), not a separate
      // banner, since it's a secondary, easy-to-miss-on-purpose detail here;
      // the fuller, explicit version lives in "Analyze this expense".
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

  // Smart category suggestion (spec section 12, 19): debounced so it doesn't
  // fire a server action on every keystroke. Falls silent once the user has
  // picked a category themselves for this expense.
  useEffect(() => {
    if (categoryTouched || !open || !form.itemName.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale suggestion once its inputs no longer apply
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
    return match && match.confidence >= 0.7 && match.merchant.name.toLowerCase() !== form.itemName.trim().toLowerCase() ? match.merchant : null;
  }, [form.itemName, form.merchant, merchants]);

  // Natural-language quick entry (spec section 45, 83): "Milk 60", "Croma
  // 18999 card" — parsed deterministically, then dropped into the normal form
  // fields so the rest of the flow (category suggestion, review, Save) is
  // identical either way.
  const [nlEntryOpen, setNlEntryOpen] = useState(false);
  const [nlText, setNlText] = useState("");

  function applyNaturalLanguageEntry() {
    if (!nlText.trim()) return;
    const parsed = parseQuickEntry(nlText);
    setForm((f) => ({
      ...f,
      itemName: parsed.itemName || f.itemName,
      amount: parsed.amount !== null ? String(parsed.amount) : f.amount,
      paymentMethod: parsed.paymentMethod ?? f.paymentMethod,
      date: parsed.expenseDate,
      merchant: null,
    }));
    setNlText("");
    setNlEntryOpen(false);
    toast.message("Parsed — review and save");
  }

  function applyMerchant(merchant: Tables<"merchants">) {
    setForm((f) => ({ ...f, merchant, itemName: merchant.name }));
    if (!categoryTouched && merchant.subcategory_id) {
      const sub = categoryFlat.find((c) => c.id === merchant.subcategory_id);
      const parent = sub ? categoryFlat.find((c) => c.id === sub.parent_id) : null;
      if (sub && parent) {
        setForm((f) => ({ ...f, category: { categoryId: parent.id, subcategoryId: sub.id, categoryName: parent.name, subcategoryName: sub.name } }));
        setCategoryTouched(true);
        toast.message(`Suggested category: ${parent.name} → ${sub.name}`);
      }
    }
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
      setReceiptFile(file); // the scanned photo is kept as the expense's receipt attachment too
      setParsedReceipt(result.data);
      setReceiptReviewOpen(true);
    } catch {
      setScanning(false);
      toast.error("Couldn't read that photo");
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

    // A category guess is only ever applied when it actually matches one of
    // this household's own categories by name — never a category id the AI
    // invented — and it's still just a starting point the person can change
    // via the normal category picker before saving (spec: AI never decides).
    if (values.categoryGuess) {
      const guess = values.categoryGuess.trim().toLowerCase();
      const match = categoryFlat.find((c) => !c.parent_id && c.name.toLowerCase().includes(guess));
      if (match) {
        setForm((f) => ({ ...f, category: { categoryId: match.id, subcategoryId: null, categoryName: match.name, subcategoryName: null } }));
        setCategoryTouched(true);
      }
    }
    toast.message("Reviewed — check the details and save");
  }

  async function uploadReceiptIfAny(): Promise<string | null> {
    if (!receiptFile) return null;
    try {
      const supabase = createClient();
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(path, receiptFile, { contentType: receiptFile.type || "image/jpeg" });
      if (error) {
        toast.error("Couldn't upload the receipt — expense will be saved without it");
        return null;
      }
      return path;
    } catch {
      toast.error("Couldn't upload the receipt — expense will be saved without it");
      return null;
    }
  }

  const { saveChip: handleQuickAdd, savingChip } = useQuickAddSave({
    onSaved: (expense) => {
      onOptimisticAdd?.(expense);
      onSaved?.(expense);
      onOpenChange(false);
    },
    onQueued: () => onOpenChange(false),
  });

  async function handleSubmit() {
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

    setSubmitting(true);
    const payload = {
      amount,
      item_name: form.itemName.trim(),
      category_id: form.category.categoryId,
      subcategory_id: form.category.subcategoryId,
      merchant_id: form.merchant?.id ?? null,
      paid_by: form.paidBy,
      expense_type: form.expenseType,
      payment_method: form.paymentMethod,
      card_id: form.cardId,
      upi_profile_id: form.upiProfileId,
      bank_account_id: form.bankAccountId,
      expense_date: form.date,
      expense_time: form.time ? `${form.time}:00` : null,
      notes: form.notes.trim() || null,
    };

    // Editing an existing expense while offline is out of scope (spec section
    // 41's caution against a "fake offline experience" — reconciling a stale
    // edit against server state safely needs more than a local queue can give
    // us). Only brand-new expenses get queued; edits always go straight to
    // the server and surface a normal error if that fails.
    if (!isEditing && isOffline()) {
      // A receipt photo can't be uploaded while offline — the expense itself
      // still queues normally (spec section 41), just without the receipt;
      // there's no local-queue support for attaching it once back online.
      if (receiptFile) toast.message("Receipt will need to be attached again once you're back online");
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${payload.item_name} queued — will sync when back online`);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const receiptPath = isEditing ? null : await uploadReceiptIfAny();
      const result = isEditing ? await updateExpense(editExpense!.id, payload) : await createExpense(payload, undefined, receiptPath);
      setSubmitting(false);

      if (result.error !== null) {
        toast.error(result.error, { action: { label: "Retry", onClick: handleSubmit } });
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
        toast.message(`${payload.item_name} queued — will sync when back online`);
        onOpenChange(false);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: handleSubmit } });
      }
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[94vh]">
          <DrawerHeader>
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{isEditing ? "Edit Expense" : "Add Expense"}</DrawerTitle>
              {isNewExpense && onOpenShoppingMode && (
                <button type="button" onClick={onOpenShoppingMode} className="text-xs font-medium text-primary">
                  Shopping mode
                </button>
              )}
            </div>
            <DrawerDescription className="sr-only">Enter the amount, item, and who it&apos;s for.</DrawerDescription>
          </DrawerHeader>

          {!isEditing && <QuickAddBar chips={quickAddChips} onPick={handleQuickAdd} disabled={savingChip !== null || loadingRefs} />}

          {!isEditing && (
            <div className="px-5">
              {!nlEntryOpen ? (
                <button
                  type="button"
                  onClick={() => setNlEntryOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Type it out instead — e.g. &quot;Milk 60&quot; or &quot;Croma 18999 card&quot;
                </button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={nlText}
                    onChange={(e) => setNlText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyNaturalLanguageEntry()}
                    placeholder="Milk 60, Vegetables 240 cash…"
                    className="flex-1"
                  />
                  <Button type="button" onClick={applyNaturalLanguageEntry} disabled={!nlText.trim()}>
                    Parse
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5">
            {/* No autoFocus here: popping the keyboard the instant this sheet
                opens (while it's still animating up) made the viewport jump
                around jarringly on mobile — let the person tap in when
                they're ready instead. */}
            <AmountInput
              value={form.amount}
              onChange={(v) => {
                setForm((f) => ({ ...f, amount: v }));
                setAmountTouched(true);
              }}
            />

            {priceMemory && (
              <div className="mb-4 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={applyPriceMemory}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-brand-mint px-3 py-2 text-left text-xs text-brand-primary"
                >
                  <span>
                    Last {formatINR(priceMemory.last)} · Typical {formatINR(priceMemory.typicalLow)}–{formatINR(priceMemory.typicalHigh)}
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-primary">Use {formatINR(priceMemory.last)}</span>
                </button>
                {priceChange && priceChange.direction !== "stable" && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Price appears {priceChange.direction} than your previous typical amount for this item (based on your own past purchases).
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4 pb-4">
              <div>
                <Label htmlFor="item-name">Item / Merchant</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="item-name"
                    value={form.itemName}
                    onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value, merchant: null }))}
                    placeholder="e.g. Milk, Zudio, Petrol"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setMerchantPickerOpen(true)} aria-label="Browse merchants">
                    <Store className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {merchantHint && (
                <button
                  type="button"
                  onClick={() => applyMerchant(merchantHint)}
                  className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-left text-sm text-foreground"
                >
                  <span>
                    Did you mean <strong>{merchantHint.name}</strong>?
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {suggestion && (
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="flex items-center justify-between gap-2 rounded-lg bg-brand-mint px-3 py-2 text-left text-sm text-brand-primary"
                >
                  <span className="min-w-0">
                    <span className="block">
                      Category: <strong>{suggestion.subcategoryName ?? suggestion.categoryName}</strong> — tap to apply
                    </span>
                    <span className="block truncate text-xs opacity-80">{suggestion.reason}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              )}

              <div>
                <Label>Category</Label>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(true)}
                  className="mt-1.5 flex h-12 w-full items-center gap-3 rounded-md border border-input bg-surface px-3.5 text-left"
                >
                  {form.category ? (
                    <>
                      <span className="text-sm font-medium text-foreground">
                        {form.category.categoryName}
                        {form.category.subcategoryName ? ` · ${form.category.subcategoryName}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Choose a category</span>
                  )}
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div>
                <Label>Paid by</Label>
                <div className="mt-1.5">
                  <PaidBySelector value={form.paidBy} onChange={(v) => setForm((f) => ({ ...f, paidBy: v }))} />
                </div>
              </div>

              <MoreOptionsDisclosure>
                <div>
                  <Label>Expense type</Label>
                  <div className="mt-1.5">
                    <ExpenseTypeSelector value={form.expenseType} onChange={(v) => setForm((f) => ({ ...f, expenseType: v }))} />
                  </div>
                </div>

                <DateTimeFields
                  date={form.date}
                  time={form.time}
                  onDateChange={(v) => setForm((f) => ({ ...f, date: v }))}
                  onTimeChange={(v) => setForm((f) => ({ ...f, time: v }))}
                />

                <div>
                  <Label>Payment method</Label>
                  <div className="mt-1.5">
                    <PaymentMethodSelect
                      methods={paymentMethods}
                      value={form.paymentMethod}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, paymentMethod: v, cardId: null, upiProfileId: null, bankAccountId: null }))
                      }
                    />
                  </div>
                </div>

                {(form.paymentMethod === "Credit Card" || form.paymentMethod === "Debit Card") && (
                  <CardQuickPicker cards={cards} value={form.cardId} onChange={(v) => setForm((f) => ({ ...f, cardId: v }))} />
                )}
                {form.paymentMethod === "UPI" && (
                  <UpiQuickPicker profiles={upiProfiles} value={form.upiProfileId} onChange={(v) => setForm((f) => ({ ...f, upiProfileId: v }))} />
                )}
                {form.paymentMethod === "Bank Transfer" && (
                  <BankQuickPicker accounts={bankAccounts} value={form.bankAccountId} onChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))} />
                )}

                {isNewExpense && (
                  <div>
                    <Label>Receipt</Label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => receiptAttachInputRef.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" /> {receiptFile ? "Replace photo" : "Attach receipt"}
                      </Button>
                      {/* "Scan receipt" is hidden (not just disabled) when no OPENAI_API_KEY is
                          configured — the manual "Attach receipt" path above never depends on
                          AI and always works, per spec: never show a feature that will
                          silently fail. */}
                      {aiConfigured && (
                        <Button type="button" variant="outline" size="sm" onClick={() => receiptScanInputRef.current?.click()} disabled={scanning}>
                          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                          {scanning ? "Reading…" : "Scan receipt"}
                        </Button>
                      )}
                      {receiptFile && (
                        <button
                          type="button"
                          onClick={() => setReceiptFile(null)}
                          className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                        >
                          {receiptFile.name.length > 20 ? `${receiptFile.name.slice(0, 17)}…` : receiptFile.name}
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <input ref={receiptAttachInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttachReceipt} />
                    <input ref={receiptScanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanReceipt} />
                  </div>
                )}

                <NotesField value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
              </MoreOptionsDisclosure>
            </div>
          </div>

          <DrawerFooter>
            <Button size="lg" onClick={handleSubmit} loading={submitting}>
              {isEditing ? "Save changes" : "Save"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <CategoryPicker
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        tree={categoryTree}
        onSelect={(selection) => {
          setForm((f) => ({ ...f, category: selection }));
          setCategoryTouched(true);
        }}
        onCategoryCreated={(cat) => setCategoryTree((t) => [...t, cat])}
      />

      <MerchantPicker
        open={merchantPickerOpen}
        onOpenChange={setMerchantPickerOpen}
        merchants={merchants}
        onSelect={applyMerchant}
        onMerchantCreated={(m) => setMerchants((list) => [...list, m])}
      />

      <ReceiptReviewSheet open={receiptReviewOpen} onOpenChange={setReceiptReviewOpen} parsed={parsedReceipt} onConfirm={applyReceiptReview} />
    </>
  );
}

// Backwards-compatible alias for the placeholder name used in app-shell.tsx.
export const AddExpenseDrawer = AddExpenseSheet;
