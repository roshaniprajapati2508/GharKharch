"use client";

import { formatINR } from "@/lib/utils";
import type { QuickAddChip } from "@/lib/actions/quick-add";

/** Horizontally scrollable "Frequently used" shortcuts (spec section 10, 22, 81). Tapping one saves instantly. */
export function QuickAddBar({ chips, onPick, disabled }: { chips: QuickAddChip[]; onPick: (chip: QuickAddChip) => void; disabled?: boolean }) {
  if (chips.length === 0) return null;

  return (
    <div className="px-5 pb-1">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Quick Add</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip, i) => (
          <button
            key={`${chip.itemName}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(chip)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-brand-mint/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-brand-mint disabled:opacity-50"
          >
            <span className="capitalize">{chip.merchantName ?? chip.itemName}</span>
            <span className="text-muted-foreground">{formatINR(chip.amount)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
