"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { ShoppingModeSheet } from "@/components/shared/shopping-mode-sheet";

interface AddExpenseContextValue {
  /**
   * Opens the single global "Add Expense" sheet from anywhere in the app
   * (empty states, quick actions, nav). Pass `quickEntry` (e.g. from the
   * Cmd+K command palette) to pre-fill the sheet via parseQuickEntry() -
   * see AddExpenseSheet's `initialQuickEntry` prop.
   */
  openAdd: (quickEntry?: string) => void;
  /** Opens the global "Shopping mode" sheet - several quick line items in one sitting (spec section 1). Reachable from inside the Add Expense sheet itself (see its header link) as well as from here directly. */
  openShopping: () => void;
  /** Registers a callback fired after the global sheet successfully saves a new expense. Returns an unsubscribe function. */
  subscribeSaved: (fn: () => void) => () => void;
}

const AddExpenseContext = createContext<AddExpenseContextValue | null>(null);

export function useAddExpense() {
  const ctx = useContext(AddExpenseContext);
  if (!ctx) throw new Error("useAddExpense must be used within AddExpenseProvider");
  return ctx;
}

/**
 * Lets the current page refetch its own data whenever the global Add Expense
 * sheet (floating "+" button, bottom nav) saves - without this, a page whose
 * data was fetched once via a server action (rather than Next's cache) would
 * only reflect an expense added through the global sheet after a manual reload.
 */
export function useOnExpenseSaved(callback: () => void) {
  const { subscribeSaved } = useAddExpense();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => subscribeSaved(() => callbackRef.current()), [subscribeSaved]);
}

/**
 * Hosts the one global Add Expense sheet instance for the whole (app) tree, so
 * the floating "+" button, bottom nav, and any page's empty state all open the
 * exact same sheet rather than each mounting their own. Editing/duplicating an
 * existing expense is handled separately by the Expenses screen, which mounts
 * its own AddExpenseSheet instance so it can reflect the result into its own
 * locally-filtered list immediately.
 */
export function AddExpenseProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [quickEntry, setQuickEntry] = useState<string | null>(null);
  const listeners = useRef(new Set<() => void>());

  const openAdd = useCallback((entry?: string) => {
    setQuickEntry(entry ?? null);
    setOpen(true);
  }, []);
  const openShopping = useCallback(() => setShoppingOpen(true), []);

  const subscribeSaved = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const notifySaved = useCallback(() => {
    listeners.current.forEach((fn) => fn());
  }, []);

  return (
    <AddExpenseContext.Provider value={{ openAdd, openShopping, subscribeSaved }}>
      {children}
      <AddExpenseSheet
        open={open}
        onOpenChange={setOpen}
        onSaved={notifySaved}
        initialQuickEntry={quickEntry}
        onOpenShoppingMode={() => {
          setOpen(false);
          setShoppingOpen(true);
        }}
      />
      <ShoppingModeSheet open={shoppingOpen} onOpenChange={setShoppingOpen} onSaved={notifySaved} />
    </AddExpenseContext.Provider>
  );
}
