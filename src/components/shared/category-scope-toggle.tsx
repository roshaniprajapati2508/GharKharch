"use client";

import { Globe2, Home, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryScope } from "@/lib/actions/analytics";

/**
 * All / Household Only / Business Only (spec: Task 4, separating the
 * Homemade Business category tree - migration 020 - from everyday household
 * living costs). Shared by Analytics and Reports rather than each screen
 * defining its own copy. A plain 3-way segmented control, not a Tabs
 * instance - this filters the data every tab/section below reads, it
 * doesn't switch between separate views.
 */
export function CategoryScopeToggle({ value, onChange }: { value: CategoryScope; onChange: (scope: CategoryScope) => void }) {
  const options: { value: CategoryScope; label: string; mobileLabel: string; icon: typeof Globe2 }[] = [
    { value: "all", label: "All Expenses", mobileLabel: "All", icon: Globe2 },
    { value: "household", label: "Household Only", mobileLabel: "Household", icon: Home },
    { value: "business", label: "Business Only", mobileLabel: "Business", icon: Briefcase },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 sm:gap-1.5 sm:p-1.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2 py-2 text-xs font-semibold transition-colors",
              active ? "bg-brand-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">{opt.mobileLabel}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
