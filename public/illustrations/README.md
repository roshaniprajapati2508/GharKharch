# Illustrations

Static SVG exports of the empty/error/onboarding illustration system, for anywhere a plain file is needed instead of a rendered React component - email templates, OG/share images, design handoff, or any external tool that can't run the app.

These are exports, not the source: the in-app source of truth is `src/components/shared/illustrations.tsx`, which renders the same artwork as inline `<svg>` React components using the theme's CSS custom properties (`var(--brand-primary)` etc.), so it automatically tracks brand color changes and dark mode. These static files bake in the current light-theme hex values instead, since a plain `.svg` file has no access to the page's CSS variables. If the brand palette in `globals.css` changes, regenerate these to match.

| File | Component | Used for |
|---|---|---|
| `empty-dashboard.svg` | `EmptyDashboardIllustration` | Dashboard "no activity yet" |
| `empty-expenses.svg` | `EmptyExpensesIllustration` | Expenses list empty state |
| `empty-search.svg` | `EmptySearchIllustration` | No search results |
| `empty-chart.svg` | `EmptyChartIllustration` | Category/merchant breakdown empty state |
| `success.svg` | `SuccessIllustration` | Confirmation moments |
| `error.svg` | `ErrorIllustration` | Error states |
| `profile.svg` | `ProfileIllustration` | Profile empty/loading placeholder |
| `onboarding.svg` | `OnboardingIllustration` | First-run / household setup |
