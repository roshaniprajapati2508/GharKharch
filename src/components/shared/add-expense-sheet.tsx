import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Store } from "lucide-react";
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
import { CategoryPickerView, type CategorySelection } from "@/components/expenses/category-picker";
import { MerchantPickerView } from "@/components/expenses/merchant-picker";
import { PaidBySelector, ExpenseTypeSelector } from "@/components/expenses/person-selector";
import { PaymentMethodSelect, CardQuickPicker, UpiQuickPicker, BankQuickPicker } from "@/components/expenses/payment-method-select";
import { DateTimeFields, NotesField } from "@/components/expenses/date-time-fields";
import { QuickAddBar } from "@/components/shared/quick-add-bar";
import { CategoryIcon } from "@/lib/icon-map";
import { useHousehold } from "@/lib/context/household-context";
import { getTodayISO, getCurrentKolkataTime } from "@/lib/date-utils";
import { createExpense, updateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { listPaymentMethodsForHousehold } from "@/lib/actions/payment-methods";
import { listUserCards, listUpiProfiles, listBankAccounts } from "@/lib/actions/payment-instruments";
import { getQuickAddChips, type QuickAddChip } from "@/lib/actions/quick-add";
import { getCategorySuggestion } from "@/lib/actions/intelligence";
import type { CategorySuggestion } from "@/lib/expense-intelligence/category-suggester";
import { suggestMerchant } from "@/lib/expense-intelligence/merchant-suggester";
import { isOffline, isNetworkError, queueExpense } from "@/lib/offline/offline-queue";
import { useOffline } from "@/lib/context/offline-context";
import { cn } from "@/lib/utils";
import type { ExpenseFormInput } from "@/lib/validations/expense";
import type { Tables, ExpenseType } from "@/types/database";

interface AddExpenseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: EnrichedExpense | null;
  duplicateFrom?: EnrichedExpense | null;
  onOptimisticAdd?: (expense: Tables<"expenses">) => void;
  onSaved?: (expense: Tables<"expenses">) => void;
}

type SheetView = "form" | "category" | "merchant";

function emptyState(userId: string) {
  return {
    amount: "",
    itemName: "",
    merchant: null as Tables<"merchants"> | null,
    category: null as CategorySelection | null,
    paidBy: userId,
    expenseType: "household" as ExpenseType,
    date: getTodayISO(),
    time: getCurrentKolkataTime(),
    paymentMethod: null as string | null,
    cardId: null as string | null,
    upiProfileId: null as string | null,
    bankAccountId: null as string | null,
    notes: "",
  };
}

export function AddExpenseSheet({ open, onOpenChange, editExpense, duplicateFrom, onOptimisticAdd, onSaved }: AddExpenseSheetProps) {
  const { userId } = useHousehold();
  const { refreshPendingCount } = useOffline();
  const isEditing = !!editExpense;

  const [sheetView, setSheetView] = useState<SheetView>("form");
  const [form, setForm] = useState(() => emptyState(userId));
  const [categoryTouched, setCategoryTouched] = useState(false);
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
    if (!open) {
      setSheetView("form");
      return;
    }

    setSheetView("form");
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
    } else {
      setForm(emptyState(userId));
      setCategoryTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editExpense, duplicateFrom]);

  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);

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

  async function handleQuickAdd(chip: QuickAddChip) {
    const payload: ExpenseFormInput = {
      amount: chip.amount || 0,
      item_name: chip.itemName,
      category_id: chip.categoryId,
      subcategory_id: chip.subcategoryId,
      merchant_id: chip.merchantId,
      paid_by: userId,
      expense_type: "household",
      expense_date: getTodayISO(),
      expense_time: `${getCurrentKolkataTime()}:00`,
    };

    if (isOffline()) {
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${chip.itemName} queued - will sync when back online`);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createExpense(payload);
      setSubmitting(false);
      if (result.error !== null) {
        toast.error(result.error, { action: { label: "Retry", onClick: () => handleQuickAdd(chip) } });
        return;
      }
      onOptimisticAdd?.(result.data);
      onSaved?.(result.data);
      toast.success(`${chip.itemName} added · ₹${chip.amount}`);
      onOpenChange(false);
    } catch (err) {
      setSubmitting(false);
      if (isNetworkError(err)) {
        await queueExpense(payload);
        refreshPendingCount();
        toast.message(`${chip.itemName} queued - will sync when back online`);
        onOpenChange(false);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: () => handleQuickAdd(chip) } });
      }
    }
  }

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

    if (!isEditing && isOffline()) {
      await queueExpense(payload);
      refreshPendingCount();
      toast.message(`${payload.item_name} queued - will sync when back online`);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const result = isEditing ? await updateExpense(editExpense!.id, payload) : await createExpense(payload);
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
        toast.message(`${payload.item_name} queued - will sync when back online`);
        onOpenChange(false);
      } else {
        toast.error("Something went wrong", { action: { label: "Retry", onClick: handleSubmit } });
      }
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh]">
        {/* Header with back navigation when browsing category or merchant */}
        <DrawerHeader className="border-b border-border/50 pb-3 pr-10">
          <div className="flex items-center justify-between">
            {sheetView !== "form" ? (
              <button
                type="button"
                onClick={() => setSheetView("form")}
                className="flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Back to expense</span>
              </button>
            ) : (
              <DrawerTitle className="text-lg font-semibold tracking-tight">
                {isEditing ? "Edit Expense" : "Add Expense"}
              </DrawerTitle>
            )}

            {sheetView !== "form" && (
              <span className="text-sm font-semibold text-foreground">
                {sheetView === "category" ? "Choose Category" : "Choose Merchant"}
              </span>
            )}
          </div>
          <DrawerDescription className="sr-only">Enter the amount, item, and expense details.</DrawerDescription>
        </DrawerHeader>

        {/* Dynamic sheet views */}
        {sheetView === "category" ? (
          <div className="flex-1 overflow-hidden">
            <CategoryPickerView
              tree={categoryTree}
              onSelect={(selection) => {
                setForm((f) => ({ ...f, category: selection }));
                setCategoryTouched(true);
                setSheetView("form");
              }}
              onCategoryCreated={(cat) => setCategoryTree((t) => [...t, cat])}
              onBack={() => setSheetView("form")}
            />
          </div>
        ) : sheetView === "merchant" ? (
          <div className="flex-1 overflow-hidden">
            <MerchantPickerView
              merchants={merchants}
              onSelect={(m) => {
                applyMerchant(m);
                setSheetView("form");
              }}
              onMerchantCreated={(m) => setMerchants((list) => [...list, m])}
              onBack={() => setSheetView("form")}
            />
          </div>
        ) : (
          <>
            {!isEditing && <QuickAddBar chips={quickAddChips} onPick={handleQuickAdd} disabled={submitting || loadingRefs} />}

            <div className="flex-1 overflow-y-auto px-5">
              <AmountInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />

              <div className="flex flex-col gap-4 pb-4">
                {/* Item / Merchant */}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSheetView("merchant")}
                      aria-label="Browse merchants"
                      title="Browse merchants"
                    >
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
                        Category: <strong>{suggestion.subcategoryName ?? suggestion.categoryName}</strong> - tap to apply
                      </span>
                      <span className="block truncate text-xs opacity-80">{suggestion.reason}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                )}

                {/* Category Selection */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Category</Label>
                    <button
                      type="button"
                      onClick={() => setSheetView("category")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Browse all
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSheetView("category")}
                    className={cn(
                      "mt-1.5 flex h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                      form.category ? "border-primary/50 bg-secondary/30" : "border-input bg-surface hover:bg-muted"
                    )}
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

                  {/* Quick popular category chips */}
                  {categoryTree.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {categoryTree.slice(0, 6).map((cat) => {
                        const isSelected = form.category?.categoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                category: {
                                  categoryId: cat.id,
                                  subcategoryId: null,
                                  categoryName: cat.name,
                                  subcategoryName: null,
                                },
                              }));
                              setCategoryTouched(true);
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              isSelected
                                ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                                : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <CategoryIcon icon={cat.icon} color={cat.color} className="flex h-4 w-4 shrink-0 items-center justify-center rounded" />
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Paid By */}
                <div>
                  <Label>Paid by</Label>
                  <div className="mt-1.5">
                    <PaidBySelector value={form.paidBy} onChange={(v) => setForm((f) => ({ ...f, paidBy: v }))} />
                  </div>
                </div>

                {/* Expense Type (Visible by default) */}
                <div>
                  <Label>Expense type</Label>
                  <div className="mt-1.5">
                    <ExpenseTypeSelector value={form.expenseType} onChange={(v) => setForm((f) => ({ ...f, expenseType: v }))} />
                  </div>
                </div>

                {/* Date & Time (Visible by default) */}
                <DateTimeFields
                  date={form.date}
                  time={form.time}
                  onDateChange={(v) => setForm((f) => ({ ...f, date: v }))}
                  onTimeChange={(v) => setForm((f) => ({ ...f, time: v }))}
                />

                {/* Payment Method (Visible by default) */}
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

                {/* Notes (Visible by default) */}
                <NotesField value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
              </div>
            </div>

            <DrawerFooter className="border-t border-border/50 bg-background/80 pt-3 backdrop-blur">
              <Button size="lg" className="h-12 w-full text-base font-semibold" onClick={handleSubmit} loading={submitting}>
                {isEditing ? "Save changes" : "Save Expense"}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Backwards-compatible alias for the placeholder name used in app-shell.tsx.
export const AddExpenseDrawer = AddExpenseSheet;
