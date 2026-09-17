"use client";

import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedReceipt } from "@/lib/ai/receipt-parser";

export interface ReceiptReviewValues {
  itemName: string;
  amount: string;
  date: string | null;
  categoryGuess: string | null;
}

/**
 * The mandatory "review before it becomes a transaction" step for AI receipt
 * scanning (spec section 3) — every extracted field lands here as a normal,
 * editable input, never a pre-saved expense. Confirming hands the values off
 * into the existing Add Expense form (add-expense-sheet.tsx sets its own
 * state from `onConfirm`'s result and the person still taps the form's own
 * "Save" button), rather than this sheet saving anything itself.
 */
export function ReceiptReviewSheet({
  open,
  onOpenChange,
  parsed,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsed: ParsedReceipt | null;
  onConfirm: (values: ReceiptReviewValues) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!open || !parsed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding the editable fields from a freshly-scanned receipt each time the sheet opens
    setItemName(parsed.merchant ?? parsed.items[0] ?? "");
    setAmount(parsed.amount !== null ? String(parsed.amount) : "");
    setDate(parsed.date ?? "");
  }, [open, parsed]);

  function confirm() {
    onConfirm({ itemName: itemName.trim(), amount, date: date || null, categoryGuess: parsed?.categoryGuess ?? null });
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Review scanned receipt</DrawerTitle>
          <DrawerDescription>Check and correct anything before it&apos;s added — nothing is saved yet.</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-5 pb-4">
          <div>
            <Label htmlFor="receipt-merchant">Merchant / item</Label>
            <Input id="receipt-merchant" value={itemName} onChange={(e) => setItemName(e.target.value)} className="mt-1.5" placeholder="Merchant or item name" />
          </div>
          <div>
            <Label htmlFor="receipt-amount">Amount</Label>
            <Input
              id="receipt-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="mt-1.5"
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="receipt-date">Date</Label>
            <Input id="receipt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
          </div>

          {parsed && parsed.items.length > 0 && (
            <div>
              <Label>Items on receipt</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {parsed.items.map((item, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsed?.categoryGuess && <p className="text-xs text-muted-foreground">Suggested category: {parsed.categoryGuess} — you can change this next.</p>}
        </div>

        <DrawerFooter>
          <Button size="lg" onClick={confirm} disabled={!itemName.trim() || !amount}>
            Continue to Add Expense
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
