"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Big, prominent, numeric-keypad-friendly amount field (spec section 9, 20, styling guide section 20). */
export const AmountInput = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; autoFocus?: boolean; className?: string }>(
  ({ value, onChange, autoFocus, className }, ref) => {
    return (
      <div className={cn("flex items-center justify-center gap-1 py-2", className)}>
        <span className="text-3xl font-bold text-muted-foreground">₹</span>
        <input
          ref={ref}
          autoFocus={autoFocus}
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9.]/g, "");
            // allow only one decimal point, max 2 decimal places
            const parts = next.split(".");
            const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : next;
            const [whole, frac] = cleaned.split(".");
            onChange(frac !== undefined ? `${whole}.${frac.slice(0, 2)}` : cleaned);
          }}
          className="w-full max-w-[220px] border-none bg-transparent text-center text-5xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      </div>
    );
  }
);
AmountInput.displayName = "AmountInput";
