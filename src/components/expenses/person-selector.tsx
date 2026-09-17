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
            "flex h-12 items-center justify-center rounded-xl border text-sm font-medium transition-colors",
            value === opt.id
              ? "border-primary bg-secondary text-secondary-foreground"
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

const EXPENSE_TYPES: { value: ExpenseType; label: string; hint: string }[] = [
  { value: "personal", label: "Personal", hint: "Just for you" },
  { value: "household", label: "Household", hint: "Shared living costs" },
  { value: "shared", label: "Shared", hint: "Split together" },
];

export function ExpenseTypeSelector({ value, onChange }: { value: ExpenseType; onChange: (value: ExpenseType) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {EXPENSE_TYPES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
            value === opt.value
              ? "border-primary bg-secondary text-secondary-foreground"
              : "border-border bg-surface text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-sm font-medium">{opt.label}</span>
          <span className="text-[11px] leading-tight opacity-80">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}
