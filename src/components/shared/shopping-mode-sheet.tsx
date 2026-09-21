"use client";

import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import type { Tables } from "@/types/database";

export function ShoppingModeSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (expense: Tables<"expenses">) => void;
}) {
  return (
    <AddExpenseSheet
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      initialMode="shopping"
    />
  );
}
