# GharKharch - Premium UX/UI Phase: Final Report

## 1. What was completed

**Motion system & interaction polish**
- Added `framer-motion` and `tw-animate-css` as dependencies; wired `tw-animate-css` into `globals.css` (this also retroactively activated `animate-in`/`fade-in-0`/`zoom-in-95` utility classes already used in `dialog.tsx`/`drawer.tsx`/`dropdown-menu.tsx` that had no working plugin before).
- Built `src/lib/motion.ts`: a shared timing/easing token system (`MOTION.micro/button/card/sheet/page`) and reusable `Variants` (`fadeInUp`, `fadeIn`, `scaleIn`, `staggerContainer`, `sheetSlideUp`, `pageTransition`, `successPop`, `listItem`), all respecting `prefers-reduced-motion` via `useReducedMotion()`.
- `Button` component: hover/press states (`active:scale-[0.98]`, shadow lift), a `loading` prop that shows a spinner and auto-disables, and `motion-reduce` variants throughout.
- `src/lib/toast-helpers.ts`: consistent `toastSuccess` / `toastError` (with retry) / `toastUndo` (with 5s undo window) wrappers over sonner; safe-area-aware toast positioning on mobile.

**Branded loading screen & page transitions**
- `src/components/shared/loading-screen.tsx`: an inline-SVG house → heart → leaves → wordmark sequence (~950ms total), reduced-motion aware.
- Wired into `src/app/loading.tsx` (root) and `src/app/(app)/loading.tsx` (shown automatically by Next.js during real async data loads, never forced on every navigation).
- `src/components/shared/page-transition.tsx`: an `AnimatePresence`-based fade/slide wrapper keyed on pathname, applied inside `AppShell` around all `(app)` route content.

**Dashboard**
- Bigger, more dominant primary spending number (`summary-header.tsx`).
- Animated category-breakdown bar fills (`category-breakdown-list.tsx`).
- New `top-merchants-card.tsx` ("Where we shop") added to the dashboard IA.
- Staggered entrance animation across all dashboard sections via `staggerContainer`/`fadeInUp`.
- All dashboard data continues to come from the real `get_*` aggregation functions - nothing fabricated; the existing real empty state remains for zero-activity households.

**SVG illustration system**
- `src/components/shared/illustrations.tsx`: six brand-consistent inline SVG illustrations (dashboard/empty-activity, expenses/receipt, search, chart/category-merchant, success checkmark, error).
- `EmptyState` now takes a `variant` prop selecting the right illustration; every existing empty state (dashboard, expenses list, reports, category/merchant/item analytics, analytics overview) was updated to use a fitting variant instead of one generic icon.

**Category management overhaul (fixes the duplicate-categories bug's UI surface)**
- Search box, an "Active/Inactive" toggle, and a "Select" bulk mode with a floating action bar (Merge / Deactivate / Delete) on `/more/categories`.
- Safe delete flow: when a category still has expenses attached, the delete dialog now requires picking a category to reassign those expenses to (via new `reassignAndDeleteCategory`) instead of just blocking the delete outright.
- Soft-delete: `setCategoryActive` lets a household deactivate a category (hidden from pickers) without touching any historical expense data - preferred over hard delete whenever there's usage.
- Reorder support (writing `sort_order`) - see the follow-up round below for the true drag-and-drop version that replaced the initial up/down-only implementation.
- Two-item "Select" mode reuses the existing `merge_categories` RPC from migration 011, so duplicates can be merged directly from the management screen, not only from the dedicated Find Duplicates page.
- New server actions in `src/lib/actions/categories.ts`: `getCategoryUsageCount`, `reassignAndDeleteCategory`, `setCategoryActive`, `bulkDeactivateCategories`, `bulkDeleteCategories`, `reorderCategories`; `listCategoriesForHousehold` now accepts `{ includeInactive }`.

**Profile management + real avatar upload**
- New `/more/profile` page: display name, optional `@username`, and a real photo upload/preview/remove flow.
- Avatar upload goes straight to Supabase Storage (`profile-images/{user_id}/avatar.<ext>`, client-side, RLS-gated) with client-side size (5MB) and MIME-type validation before upload; the resulting public URL is persisted via a new `setMyAvatarUrl` server action.
- New `src/lib/actions/profile.ts`: `getMyProfile`, `updateMyProfile` (validates & uniqueness-checks `username`), `setMyAvatarUrl`.
- `src/components/shared/user-avatar.tsx`: a shared avatar-with-initials-fallback component, now used on the More page for both the signed-in user and their partner, and in the household layout context so avatars are available app-wide.
- `HouseholdContextValue` extended with `username`, `avatarUrl`, and `partner.avatarUrl`.

**Auth UX polish**
- `src/components/shared/password-input.tsx`: show/hide toggle, used on both login and signup.
- Login/signup/onboarding forms now use the `Button` component's `loading` state (spinner + auto-disable) instead of plain text swaps, and both auth pages get an entrance fade via `fadeInUp`; the "check your email" confirmation state gets a `successPop` animation.
- Sign-out button on the More page also uses `loading` for a consistent "Signing out…" spinner state.

**Settings/More screen regrouping**
- `/more` is now organized into labeled sections with icons: **Profile**, **Household**, **Money** (categories/merchants/duplicates/payment methods), **App** (Ask GharKharch), **Security** (sign out) - replacing the previous flat two-card layout.

## 1b. Follow-up round - everything from the "what's left" punch list

**Merchant alias + grouping system**
- Merchants settings page: tapping a household-owned merchant now opens a bottom-sheet drawer (`/more/merchants`) to add/remove aliases (e.g. "instamart" → Swiggy Instamart) and set a parent merchant (e.g. group under "Swiggy"). Search now also matches on aliases. New actions: `addMerchantAlias`, `removeMerchantAlias`, `setMerchantParent` in `src/lib/actions/merchants.ts`.

**True drag-and-drop category reorder**
- Added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` as dependencies (no drag library existed before).
- `/more/categories` now supports real pointer/touch drag reordering via a grip handle on each row, for both top-level categories and each group's subcategories, with keyboard-accessible dragging (arrow keys once a handle is focused) as well. The up/down buttons stay as an explicit accessible fallback. Drag is disabled while searching or in bulk-select mode to avoid reordering a filtered view.

**Interaction-pattern audit (save/delete/duplicate consistency)**
Ran a full sweep across expenses, categories, merchants, payment methods, and the add/edit expense sheet, then fixed every gap found:
- Every remaining manual "Saving…"/spinner-toggle button now uses `Button`'s `loading` prop: the Add/Edit Expense sheet's Save button, the duplicates-merge confirm button, category bulk-action buttons, and every Add/Save button across the four Payment Methods tabs (Methods, Cards, UPI, Banks).
- **Payment Methods page was rebuilt**: every delete (payment method, card, UPI profile, bank account) previously fired immediately with no confirmation - now every one is gated behind a `ConfirmationDialog`, matching the pattern categories/merchants already had. Delete/remove actions on that page now also show a success toast (previously silent).
- Merchant alias add/remove now shows a success toast (previously silent on success).
- Category bulk Deactivate/Delete/Merge actions are now gated behind a `ConfirmationDialog` instead of firing immediately on click.
- The dashboard's and expenses list's "Expense deleted [Undo]" toasts were migrated from a one-off inline `toast()` call to the shared `toastUndo` helper for consistency, and now show the amount in the message.

**Accessibility pass**
- Added a `.safe-top` utility (mirroring the existing `.safe-bottom`) and applied it to the sticky top bar, so it no longer sits flush under a phone's notch/status bar.
- Applied `.safe-bottom` to the shared bottom-sheet component (`drawer.tsx`) and the category page's inline "add category" sheet, so sheet content and footer buttons clear the home-indicator area on iOS.
- Reduced-motion support (already in place via `useReducedMotion()`/`motion-reduce:`) and the new drag reordering's keyboard support were verified as part of this pass.
- **Not done**: a full color-contrast/WCAG audit. That needs actual visual/rendering tooling (a real browser render or an axe-core pass) rather than something safely verifiable by reading code, and running a browser-based audit tool falls under the "no heavy build/render jobs without approval" policy - flagging this rather than guessing at contrast ratios from token names.

## 2. Migrations created (ready to run, none executed remotely)

All in `supabase/migrations/`, complete and idempotent:

- **`011_dedup_and_merge.sql`** *(created earlier this phase, fixed this session's predecessor)* - one-time fixed-point cleanup of duplicate global categories/merchants, reassigning every dependent reference before deleting duplicates; adds the scoped unique index `idx_categories_unique_scope`; adds `find_duplicate_categories`/`find_duplicate_merchants` and `merge_categories`/`merge_merchants` RPCs.
- **`012_profile_storage.sql`** *(new this session)* - adds an optional, unique `username` column to `profiles` (plain unique index on `lower(username)`, `NULL`s naturally excluded); creates the `profile-images` Storage bucket (public read, 5MB limit, image MIME allowlist); adds RLS policies on `storage.objects` so a user can only insert/update/delete objects inside their own `{user_id}/` folder.

**`supabase/migrations/README.md`** was updated with 012's entry, its "what it does" section, and its dependency note (depends only on 001, no dependency on 002-011).

**You still need to run, in order, in the Supabase SQL Editor:** `011_dedup_and_merge.sql`, then `012_profile_storage.sql`. Everything from 001-010 you've already confirmed is live.

## 3. Every major file created or modified this phase

**New files:**
`src/lib/motion.ts`, `src/lib/toast-helpers.ts`, `src/components/shared/loading-screen.tsx`, `src/components/shared/page-transition.tsx`, `src/components/shared/illustrations.tsx`, `src/components/shared/password-input.tsx`, `src/components/shared/user-avatar.tsx`, `src/components/dashboard/top-merchants-card.tsx`, `src/lib/actions/profile.ts`, `src/lib/actions/duplicates.ts`, `src/app/(app)/more/duplicates/page.tsx`, `src/app/(app)/more/profile/page.tsx`, `src/app/loading.tsx`, `src/app/(app)/loading.tsx`, `supabase/migrations/011_dedup_and_merge.sql`, `supabase/migrations/012_profile_storage.sql`.

**Modified files (initial pass):**
`package.json`, `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/ui/sonner.tsx`, `src/components/shared/app-shell.tsx`, `src/components/shared/empty-state.tsx`, `src/components/shared/confirmation-dialog.tsx`, `src/components/dashboard/summary-header.tsx`, `src/components/dashboard/category-breakdown-list.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/more/page.tsx`, `src/app/(app)/more/categories/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/onboarding/page.tsx`, `src/lib/context/household-context.tsx`, `src/lib/actions/categories.ts`, `src/lib/actions/merchants.ts` (async-export build-error fix), `src/lib/merchant-utils.ts` (new, extracted), `src/types/database.ts`, `src/components/expenses/expense-list.tsx`, `src/components/reports/reports-page-client.tsx`, `src/components/analytics/merchant-analytics-tab.tsx`, `src/components/analytics/item-analytics-tab.tsx`, `src/components/analytics/category-analytics-tab.tsx`, `src/components/analytics/analytics-page-client.tsx`, `supabase/migrations/README.md`.

**Modified/created in the follow-up round:**
`package.json` (added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`), `src/lib/actions/merchants.ts` (alias/parent actions), `src/app/(app)/more/merchants/page.tsx` (alias/grouping drawer), `src/app/(app)/more/categories/page.tsx` (drag-and-drop reorder, bulk-action confirmation dialogs), `src/app/(app)/more/payment-methods/page.tsx` (rebuilt: confirmation dialogs, loading states, toasts on every tab), `src/components/shared/add-expense-sheet.tsx` (Save button `loading` prop), `src/app/(app)/more/duplicates/page.tsx` (merge button `loading` prop), `src/components/expenses/expenses-page-client.tsx` + `src/app/(app)/dashboard/page.tsx` (undo toast migrated to `toastUndo`), `src/components/ui/drawer.tsx` (safe-area bottom padding), `src/components/shared/top-bar.tsx` (safe-area top padding), `src/app/globals.css` (new `.safe-top` utility).

## 4. Basic checks actually run

- `npx tsc --noEmit` - run repeatedly after every batch of changes in the cloud workspace. **Clean, no errors**, at the end of the phase.
- `npx eslint .` - run repeatedly after every batch of changes. **Clean, no errors/warnings**, at the end of the phase.
- No other checks were run.

## 5. Explicitly not run (per standing policy)

- **Full QA suite: not run.**
- **`audit.mjs`: not run.**
- **Full test suite: not run.**
- **Production build: not run.**
- **Remote Supabase migration: not run.** Migrations 011 and 012 are prepared as files only - you need to run them yourself via the SQL Editor.

## 6. What you need to do

1. Run `011_dedup_and_merge.sql` then `012_profile_storage.sql` against your live Supabase project, in that order.
2. On your machine, run `npm install` (picks up `framer-motion`, `tw-animate-css`, and `@dnd-kit/core` / `@dnd-kit/sortable` / `@dnd-kit/utilities`), then `npm run dev` as usual.
3. Everything else (all component/page/action changes) is already synced into your project folder.

## 7. Known gaps / scope notes

- **Bank-account picker on Add/Edit Expense** is still not wired in (only card and UPI are) - a pre-existing gap from earlier in the project, separate from this phase's scope. Editing an expense that had a `bank_account_id` set will still null it out on save. Say the word if you'd like this fixed next.
- **Color-contrast/WCAG audit** was not performed (see section 1b) - everything else on the original "what's left" list has been addressed.
- Avatar removal does a best-effort storage cleanup (lists and removes files in the user's `profile-images/{user_id}/` folder); if that step silently fails for any reason, the profile's `avatar_url` column is still cleared correctly since it's the actual source of truth for what's displayed.

## 8. Final gap-closing round - 110-item spec verification

You asked me to verify the full 110-item spec, not just re-assert completion. I ran an independent, adversarial, read-only audit against the actual codebase and found 9 real gaps (plus one false negative). Per your instruction to close them all in order without stopping, here's what happened to each:

**Fixed this round:**
- **Reduced-motion coverage (item 87)** - was inconsistent (a handful of ad-hoc `useReducedMotion()` checks). Fixed systemically by wrapping the app in a single `<MotionConfig reducedMotion="user">` provider in `src/components/shared/app-shell.tsx` and `src/app/(auth)/layout.tsx`, so every `motion.*` component under either boundary now automatically respects the OS `prefers-reduced-motion` setting - no per-component logic needed.
- **Spending calendar missing from Dashboard (item 30-ish)** - `SpendingCalendar` previously only appeared on the Analytics page. It's now also rendered on the Dashboard (`src/app/(app)/dashboard/page.tsx`), reusing the existing component as-is.
- **"Most frequent expenses" and "Largest expenses" as dashboard cards (items 28-29)** - added a new `MostFrequentCard` (`src/components/dashboard/most-frequent-card.tsx`) and wired the existing `TopExpensesList` into the Dashboard, both fed by data the dashboard was already fetching (`itemAnalytics`, `topExpenses`) - no new queries needed.
- **Dashboard background decoration (item 20)** - added `DashboardBackgroundDecoration` (`src/components/dashboard/background-decoration.tsx`), a fixed, low-opacity (`5%`), `pointer-events-none` SVG of flowing brand-colored lines and leaf shapes behind the dashboard content.
- **Genuinely distinct responsive dashboard layout per breakpoint (items 33-34, 93-94)** - replaced the single-column flex stack with a `.dashboard-grid` CSS Grid using named `grid-template-areas` (in `src/app/globals.css`), with different area layouts at mobile, 640px (tablet), and 1024px (desktop) - sections genuinely regroup at each breakpoint rather than just scaling down.
- **SVG illustration system completeness (item 19)** - added the two missing illustrations, `ProfileIllustration` and `OnboardingIllustration` (`src/components/shared/illustrations.tsx`), registered them in `EmptyState`'s variant map, and wired them into real call sites: `OnboardingIllustration` now appears above the "Set up your household" heading in `src/app/(auth)/onboarding/page.tsx`, and `ProfileIllustration` now replaces the generic pulse placeholder in the profile page's loading state (`src/app/(app)/more/profile/page.tsx`).
- **`public/brand/` and `public/illustrations/` organization (item 72)** - moved `logo-full.png` into a new `public/brand/` folder (updated the one reference in `src/components/shared/logo.tsx`) and generated static `.svg` exports of all 8 illustrations into a new `public/illustrations/` folder, for anywhere a plain file is needed (email templates, OG images, external tools) instead of the live React components. Both folders include a short `README.md` explaining the split: the inline components in `illustrations.tsx` remain the actual in-app rendering source of truth (they track theme/dark-mode via CSS variables), while the static SVGs bake in the current light-theme colors as portable exports. PWA icons/favicons were deliberately left in `public/icons/` since manifest.json and page metadata already reference them there - moving them had no spec benefit and real risk of breaking the PWA install/favicon chain.

**Corrected - false negatives, no code change needed:**
- **Password-visibility toggle (item 56)** - the audit's grep-based check looked for `EyeOff`/`showPassword` directly inside the login/signup page files and got zero hits, but missed that both pages already import and use the shared `PasswordInput` component (`src/components/shared/password-input.tsx`), which has a complete, working show/hide toggle. This was already done; nothing needed fixing.
- **Swipe-to-delete/edit gestures on expense rows (item 71)** - re-checked `src/components/expenses/expense-row.tsx` directly and found a complete pointer-based swipe implementation already in place (drag-to-reveal Edit/Delete action buttons, with the existing tap-to-open dropdown menu as the required accessible non-swipe alternative). This was already done; the audit's finding here was also incorrect.

**Checks run after this round:** `npx tsc --noEmit` and `npx eslint .` - both clean, no errors or warnings, across every file touched in this round.

**Still explicitly not run:** Full QA suite, `audit.mjs`, full test suite, production build, remote Supabase migration - none of this round's work touched the database, so no new migrations were needed.

All 9 audit gaps are now closed: 7 by actual code changes, 2 corrected as pre-existing false negatives. This is synced to your machine per the usual process.
