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
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex h-12 items-center justify-center rounded-xl border px-3 text-center text-sm font-semibold transition-all",
            value === opt.id
              ? "border-primary bg-secondary text-secondary-foreground shadow-sm"
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
    <div className="grid grid-cols-2 gap-2.5">
      {EXPENSE_TYPES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-1.5 text-center transition-all",
            value === opt.value
              ? "border-primary bg-secondary text-secondary-foreground shadow-sm"
              : "border-border bg-surface text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-sm font-semibold leading-tight">{opt.label}</span>
          <span className="text-xs leading-tight opacity-75">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}
