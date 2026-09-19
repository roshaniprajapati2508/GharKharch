# GharKharch - Add Expense sheet: layout QA brief

## App context
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, Supabase backend.
- Repo root (on this machine): `C:\Users\harsh\Desktop\GharKharch`
- Relevant files:
  - `src/components/shared/add-expense-sheet.tsx` - the whole "Add Expense" bottom sheet/drawer.
  - `src/components/expenses/person-selector.tsx` - exports `PaidBySelector` and `ExpenseTypeSelector`, the two pill/card pickers used inside the sheet.
  - `src/components/ui/drawer.tsx` - the underlying `vaul`-based Drawer primitive (`DrawerContent`, `DrawerHeader`, `DrawerFooter`).

The sheet is a bottom drawer on mobile and the same component (not a separate desktop variant) on wider screens - `DrawerContent` is capped at `max-w-lg sm:max-w-xl` (576px), so it never spans a full desktop window; it just sits centered and narrower.

## What's being asked
Visually QA and fix (if still broken) three things in the "Single Expense" form body of `add-expense-sheet.tsx`, at both a phone-width viewport (~375-430px) and a wider desktop/tablet viewport (~700-1000px+):

1. **"Paid By" and "Type" sections** (the two pickers rendered side by side, each with 2 option buttons inside) must render as **two fixed columns, side by side, at every viewport width** - never collapse into one stacked column.
   - Current implementation: the wrapping `<div>` around them uses `className="grid grid-cols-2 gap-3 pt-1"` (search for the comment `{/* Paid By & Expense Type`). This should NOT have a responsive variant like `sm:grid-cols-2` with a `grid-cols-1` base - it should just always be `grid-cols-2`.
   - Inside each column: `PaidBySelector` and `ExpenseTypeSelector` in `person-selector.tsx` each render their own internal `grid-cols-2` (2 buttons per selector, so 4 buttons total across the two outer columns).

2. **"Date" row** (Today pill / Yesterday pill / native `<input type="date">`) must stay a **single inline row at every width**, with the two pills at their natural compact size (not stretched) and the date input filling the remaining space without overflowing or wrapping awkwardly.
   - Current implementation: a `<div className="flex items-center gap-1.5">` containing the Today button (`shrink-0`), Yesterday button (`shrink-0`), and the date `<Input type="date" className="h-9 min-w-0 flex-1 text-xs bg-background" />`.
   - Known risk area: the *native* browser date input's own internal chrome (the calendar icon, the way Chrome/Safari/Firefox render the date segments) is not fully stylable and can look/behave differently across browsers and OSes - if there's still a visual issue here, check whether it's actually this flex layout vs. the native input's own rendering quirks (e.g. Windows Chrome vs. Android Chrome vs. desktop Safari).

3. **"Notes (Optional)"** should be its own full-width row/section (not paired in a 2-column grid with anything else) - this was previously grouped with Date in one `grid-cols-2` row, which is why the Date row felt cramped; both are now separate full-width blocks, one after the other.

## What's already been changed (for context, not to be redone)
Three commits already landed on `main` addressing this:
1. `221026e` - split Date and Notes into separate full-width rows (previously paired in one 2-col grid); also shrank the Paid By/Type button sizing from `md:` up (they were sized for a mobile touch target at every breakpoint, which looked oversized on wider screens: added `md:h-10 md:text-[13px]` to the Paid By buttons in `person-selector.tsx` and `md:py-1.5` to the Type cards).
2. `99e5fe8` - reverted an intermediate attempt that made the Paid By/Type columns stack below the `sm` breakpoint (640px) and that made the Date row's Today/Yesterday pills stretch to fill a grid column. Replaced with: Paid By/Type always `grid-cols-2` (no stacking), and Date back to a single flex row with `shrink-0` pills + `flex-1 min-w-0` input.

If the layout still looks wrong after pulling these commits, the most likely causes to check first:
- The live page hasn't actually picked up the latest commit yet (stale Vercel deploy, or a local dev server that needs a restart/hard refresh).
- A real device/browser is rendering the native `<input type="date">` chrome differently than expected (this is OS/browser-controlled, not something Tailwind classes can fully fix - worth screenshotting on the actual target browser, not just resizing a desktop Chrome window).
- Any concurrent edits to `add-expense-sheet.tsx` or `person-selector.tsx` from another session/branch that haven't been merged/pulled, causing a mismatch between what's live and what's in the repo.

## Ask
1. Pull latest `main`, run the app, and actually visually inspect the Add Expense sheet's Paid By / Type / Date / Notes area at:
   - A real phone width (~375-430px, e.g. iPhone SE / standard Android).
   - A tablet/narrow-desktop width (~700-900px).
   - A full desktop width (~1200px+).
2. Confirm or fix so that: Paid By and Type are always 2 columns side by side; Date is always one inline row (pills compact, input filling remaining space, no overflow/wrap); Notes is its own full-width row below Date.
3. Do not change anything else in these files - there's a second, actively-developed session working in the same repo, so keep the diff scoped to exactly this layout fix.
4. Run `npx tsc --noEmit` after any change and confirm it's clean before considering this done.
