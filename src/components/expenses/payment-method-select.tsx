"use client";

import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icon-map";
import type { Tables } from "@/types/database";

/** Horizontal chip row of the household's active payment methods (spec section 9, 61). Optional — can stay unset. */
export function PaymentMethodSelect({
  methods,
  value,
  onChange,
}: {
  methods: Tables<"payment_methods">[];
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {methods.map((m) => {
        const Icon = getIcon(m.icon);
        const active = value === m.name;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(active ? null : m.name)}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

/** When Credit/Debit Card is the payment method and the household has cards on file, let them pick which one (spec addendum section 22-23). */
export function CardQuickPicker({
  cards,
  value,
  onChange,
}: {
  cards: Tables<"user_cards">[];
  value: string | null;
  onChange: (cardId: string | null) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Which card?</p>
      <div className="flex flex-wrap gap-2">
        {cards.map((c) => {
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(active ? null : c.id)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
              )}
            >
              {c.custom_name}
              {c.last4 ? ` •••• ${c.last4}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** When Bank Transfer is the payment method and the household has bank accounts on file, let them pick which one — mirrors CardQuickPicker/UpiQuickPicker. Fixes a gap where editing an expense that already had a bank account attached would silently clear it on save. */
export function BankQuickPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: Tables<"bank_accounts">[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (accounts.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Which bank account?</p>
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => {
          const active = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(active ? null : a.id)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
              )}
            >
              {a.bank_name}
              {a.account_last4 ? ` •••• ${a.account_last4}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UpiQuickPicker({
  profiles,
  value,
  onChange,
}: {
  profiles: Tables<"upi_profiles">[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (profiles.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Which UPI app?</p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(active ? null : p.id)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
