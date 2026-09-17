// Brand-consistent inline SVG illustration system (spec item 28) for empty and
// error states - each one reuses the same house/leaf/coin motif and brand
// color tokens as the loading screen, so the "nothing here yet" moments feel
// designed rather than borrowed from a generic icon set.

type IllustrationProps = { className?: string };

function Base({ className, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Dashboard / general "no activity yet" - a coin sprouting a leaf. */
export function EmptyDashboardIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="80" rx="40" ry="6" fill="var(--brand-mint)" />
      <circle cx="60" cy="52" r="26" fill="var(--brand-cream)" stroke="var(--brand-primary)" strokeWidth="3" />
      <path d="M60 40 L60 30" stroke="var(--brand-green)" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 32 Q66 26 72 30 Q68 36 60 34" fill="var(--brand-green)" />
      <path d="M60 32 Q54 26 48 30 Q52 36 60 34" fill="var(--brand-green)" />
      <text x="60" y="60" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--brand-primary)">
        ₹
      </text>
    </Base>
  );
}

/** Expenses list / transactions - a receipt strip. */
export function EmptyExpensesIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="82" rx="34" ry="5" fill="var(--brand-mint)" />
      <path d="M40 20 H80 V72 L74 66 L68 72 L62 66 L56 72 L50 66 L44 72 Z" fill="var(--brand-cream)" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="48" y1="32" x2="72" y2="32" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="40" x2="72" y2="40" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <line x1="48" y1="48" x2="64" y2="48" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </Base>
  );
}

/** Search - magnifying glass over a blank card. */
export function EmptySearchIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="82" rx="30" ry="5" fill="var(--brand-mint)" />
      <rect x="34" y="26" width="44" height="34" rx="6" fill="var(--brand-cream)" stroke="var(--brand-primary)" strokeWidth="2.5" />
      <circle cx="68" cy="56" r="14" fill="none" stroke="var(--brand-orange)" strokeWidth="3.5" />
      <line x1="78" y1="66" x2="88" y2="76" stroke="var(--brand-orange)" strokeWidth="3.5" strokeLinecap="round" />
    </Base>
  );
}

/** Category / merchant breakdown - a simple bar chart. */
export function EmptyChartIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="82" rx="34" ry="5" fill="var(--brand-mint)" />
      <rect x="34" y="50" width="12" height="24" rx="3" fill="var(--brand-primary)" opacity="0.85" />
      <rect x="54" y="34" width="12" height="40" rx="3" fill="var(--brand-orange)" opacity="0.85" />
      <rect x="74" y="44" width="12" height="30" rx="3" fill="var(--brand-green)" opacity="0.85" />
    </Base>
  );
}

/** Success / confirmation - checkmark badge. */
export function SuccessIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <circle cx="60" cy="48" r="30" fill="var(--brand-mint)" />
      <path d="M46 48 L56 58 L76 36" stroke="var(--brand-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}

/** Error / something went wrong - a gentle exclamation, not alarming. */
export function ErrorIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <circle cx="60" cy="48" r="30" fill="var(--brand-cream)" stroke="var(--brand-orange)" strokeWidth="2.5" />
      <line x1="60" y1="36" x2="60" y2="52" stroke="var(--brand-orange)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="60" r="2.5" fill="var(--brand-orange)" />
    </Base>
  );
}

/** Profile - a friendly person silhouette in a soft badge, for a profile empty/loading placeholder. */
export function ProfileIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="82" rx="30" ry="5" fill="var(--brand-mint)" />
      <circle cx="60" cy="46" r="28" fill="var(--brand-cream)" stroke="var(--brand-primary)" strokeWidth="2.5" />
      <circle cx="60" cy="38" r="9" fill="var(--brand-primary)" opacity="0.85" />
      <path d="M40 62 C 40 50, 80 50, 80 62" fill="var(--brand-primary)" opacity="0.85" />
    </Base>
  );
}

/** Onboarding / welcome - the household roof-and-heart motif, used for first-run and "you're all set" moments. */
export function OnboardingIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <ellipse cx="60" cy="82" rx="36" ry="5" fill="var(--brand-mint)" />
      <path d="M28 52 L60 26 L92 52 V72 A4 4 0 0 1 88 76 H32 A4 4 0 0 1 28 72 Z" fill="var(--brand-cream)" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M60 66 C 60 66, 48 58, 48 49.5 C 48 44, 52.5 40, 57 40 C 58.7 40, 60 41, 60 43 C 60 41, 61.3 40, 63 40 C 67.5 40, 72 44, 72 49.5 C 72 58, 60 66, 60 66 Z"
        fill="var(--brand-orange)"
      />
    </Base>
  );
}
