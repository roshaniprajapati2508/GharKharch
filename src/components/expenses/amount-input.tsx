"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Big, prominent, numeric-keypad-friendly amount field with snugly positioned currency symbol (spec section 9, 20). */
export const AmountInput = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; autoFocus?: boolean; className?: string }>(
  ({ value, onChange, autoFocus, className }, ref) => {
    const charCount = (value || "0").length;
    return (
      <div className={cn("flex items-center justify-center py-2", className)}>
        <div className="inline-flex items-center justify-center gap-1.5">
          <span className="text-3xl font-bold text-muted-foreground/60 select-none pb-0.5">₹</span>
          <input
            ref={ref}
            autoFocus={autoFocus}
            inputMode="decimal"
            placeholder="0"
            value={value}
            style={{ width: `${Math.max(1, charCount) * 1.15 + 0.3}ch` }}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9.]/g, "");
              // allow only one decimal point, max 2 decimal places
              const parts = next.split(".");
              const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : next;
              const [whole, frac] = cleaned.split(".");
              onChange(frac !== undefined ? `${whole}.${frac.slice(0, 2)}` : cleaned);
            }}
            className="border-none bg-transparent text-left text-5xl font-extrabold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 min-w-[1.2ch] max-w-[340px] p-0"
          />
        </div>
      </div>
    );
  }
);
AmountInput.displayName = "AmountInput";
