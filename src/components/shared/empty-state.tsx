"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EmptyDashboardIllustration,
  EmptyExpensesIllustration,
  EmptySearchIllustration,
  EmptyChartIllustration,
  SuccessIllustration,
  ErrorIllustration,
  ProfileIllustration,
  OnboardingIllustration,
} from "@/components/shared/illustrations";

const ILLUSTRATIONS = {
  dashboard: EmptyDashboardIllustration,
  expenses: EmptyExpensesIllustration,
  search: EmptySearchIllustration,
  chart: EmptyChartIllustration,
  success: SuccessIllustration,
  error: ErrorIllustration,
  profile: ProfileIllustration,
  onboarding: OnboardingIllustration,
} as const;

export type EmptyStateVariant = keyof typeof ILLUSTRATIONS;

export function EmptyState({
  title,
  description,
  ctaLabel,
  onCta,
  chips,
  className,
  variant = "dashboard",
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  chips?: string[];
  className?: string;
  /** Which brand illustration to show (spec item 28: SVG illustration system for empty/error states). */
  variant?: EmptyStateVariant;
}) {
  const Illustration = ILLUSTRATIONS[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-border bg-gradient-to-b from-brand-mint/60 to-brand-cream/60 px-6 py-12 text-center",
        className
      )}
    >
      <Illustration className="h-24 w-auto" />
      <div className="max-w-xs">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {ctaLabel && onCta && (
        <Button size="lg" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
      {chips && chips.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
