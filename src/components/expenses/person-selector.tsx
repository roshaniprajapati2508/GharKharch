"use client";

import { cn } from "@/lib/utils";
import { useHousehold } from "@/lib/context/household-context";
import type { ExpenseType } from "@/types/database";

/** "Paid by" is always a real user - Me or the partner (spec section 9, 36; see phase-1 note reconciling section 15 vs 36). */
export function PaidBySelector({ value, onChange }: { value: string; onChange: (userId: string) => void }) {
  const { userId, displayName, partner } = useHousehold();

  const options = [
    { id: userId, label: "Me" },
    ...(partner ? [{ id: partner.id, label: partner.displayName }] : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex h-[52px] items-center justify-center rounded-xl border px-2 text-center text-sm font-medium transition-colors",
            value === opt.id
              ? "border-primary bg-secondary text-secondary-foreground font-semibold"
              : "border-border bg-surface text-muted-foreground hover:bg-muted"
          )}
        >
          {opt.label}
        </button>
      ))}
      {!partner && <p className="col-span-2 text-xs text-muted-foreground">{displayName}, invite your partner from More to split who paid.</p>}
    </div>
  );
}

// Only two expense types are offered here: this app is for exactly two
// people, so "personal" (just you) vs "household" (shared living costs)
// already covers every real case - a separate "shared/split" option was
// redundant and confusing. The "shared" value stays in the ExpenseType
// union/DB enum for backward compatibility with any existing rows; it's
// just no longer offered in this picker.
const EXPENSE_TYPES: { value: ExpenseType; label: string; hint: string }[] = [
  { value: "personal", label: "Personal", hint: "Just for you" },
  { value: "household", label: "Household", hint: "Shared living costs" },
];

export function ExpenseTypeSelector({ value, onChange }: { value: ExpenseType; onChange: (value: ExpenseType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {EXPENSE_TYPES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-[52px] flex-col items-center justify-center rounded-xl border px-1 py-1 text-center transition-colors",
            value === opt.value
              ? "border-primary bg-secondary text-secondary-foreground font-semibold"
              : "border-border bg-surface text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-xs sm:text-sm font-medium leading-tight">{opt.label}</span>
          <span className="text-[10px] sm:text-[11px] leading-tight opacity-80">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}
