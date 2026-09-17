# GharKharch — V2 Smart Intelligence Phase: Documentation (spec section 51)

This documents the current, verified state of the app against the two source
documents that drove this phase: the original **A–J verification checklist**
and the **V2 "Smart Product Intelligence + Premium UX/UI" brief**. It was
compiled by reading the actual committed code on 2026-09-17, not by trusting
either document's own claims — every row below was confirmed against a real
file in the repository.

Note on authorship: most of this phase's features were built across two
concurrent work threads on this repository. This report documents what
exists today regardless of which thread built it.

## A–J checklist status

| Item | Status | Where |
|---|---|---|
| A. Advanced expense search (item/merchant/category/notes/amount/person/date) | Done | `src/components/expenses/expense-search.tsx` — unified command-palette query box parses all seven fields (amount via `>`/`<`, person via "me"/partner name, date via month names), rather than separate filter inputs |
| B. Category analytics (total/%/count/avg/high/low/prev-comparison/trend) | Done | `get_category_breakdown`, `get_category_monthly_trend` (migration 016), `analytics.ts` |
| C. Merchant analytics (total/count/avg/highest/last/monthly-trend/share) | Done | `get_merchant_breakdown` (015: added `lowest_transaction`/`share_pct`), `get_merchant_monthly_trend`, `get_merchant_category_share` (016) |
| D. Item-level consumption intelligence | Done | `get_item_analytics` (015: added `estimated_monthly_spend`), `insights.ts: getItemPriceMemory`/`detectPriceChange` |
| 3. Spending Intelligence layer | Done | `spending-intelligence.ts` + `/analytics/intelligence` page (weekday/date peaks, household-vs-personal split, per-payer totals, recurring-vs-one-off, fastest-moving category/merchant/item) |
| 4. Payment analytics (card/UPI/cash) | Done | `analytics.ts` card/UPI breakdowns, `get_card_breakdown`/`get_upi_breakdown` (016), `payment-instruments.ts` |
| 5. Recurring expense UX (upcoming/due/monthly total) | Done | `recurring.ts: logRecurringOccurrence`, due-date advancement, `recurring-suggestions-card.tsx` |
| 6. Budget forecast/pacing | Done | `budgets.ts: listBudgetsForMonth` computes `projectedSpend` (spent-so-far ÷ days-elapsed × days-in-month) per budget, shown on `/more/budgets` with an over-pace warning marker |
| 7. Data portability (CSV/JSON/PDF/backup/import) | Done | `reports.ts` (`exportExpensesCsv`/`exportExpensesJson`/`exportHouseholdBackup`/`importExpensesFromCsv`), `report-pdf.ts` (real jsPDF report), `/more/import` |
| 8. AI / Ask GharKharch expansion | Done | `financial-query.ts` (adds `most_frequent_items`, `amount_threshold`, `recurring_list`, "last weekday"/"last N months" parsing), `ai-assistant.ts`, `/more/ask` (typing animation + sound effects added) |
| 9. Offline architecture preserved | Confirmed unchanged | `public/sw.js`, `lib/offline/*` — not touched by this phase |
| "Same as last time" one-tap repeat | Done | `expenses.ts: duplicateExpense` — Repeat icon on every expense row and in search results |

## V2 brief — feature additions

| Feature | Status | Where |
|---|---|---|
| Daily/weekly snapshot | Done | `insights.ts: getDailyWeeklySnapshot`, `daily-brief-card.tsx` |
| Smart amount memory | Done | `insights.ts: getItemPriceMemory`, amount-memory suggestion row in `add-expense-sheet.tsx` |
| Spending forecast (month-end) | Done | `insights.ts: getHouseholdForecast`, `forecast-card.tsx` — deliberately a separate card from Daily Brief, since a projection is a different kind of claim than "what happened" |
| Where-did-spending-change | Done | `insights.ts: getSpendingChanges` — top-5 category movers month over month |
| Daily Brief composite card | Done | `daily-brief-card.tsx` — greeting + snapshot + spending-change summary + next upcoming recurring + quick-add chips |
| Multi-expense / Shopping mode | Done | `shopping-mode-sheet.tsx` — rapid per-item entry, running total |
| Analyze this expense | Done | `expense-analysis.ts` + `analyze-expense-sheet.tsx` — category share, merchant-vs-typical, month impact, similar prior purchases, price-change flag |
| Receipt scanning/attachments | Done | `017_receipts.sql` (private Storage bucket + RLS), `receipts.ts`, `receipt-parser.ts` (AI OCR, mandatory editable review before save) |
| Price-change detection | Done | `insights.ts: detectPriceChange` — 10% threshold, needs ≥3 prior purchases |
| Command palette / global search (not in original brief, found already built) | Done | `expense-search.tsx`, global Cmd+K |

## Migrations added this phase (`supabase/migrations/`)

- **015_analytics_enhancements.sql** — merchant `lowest_transaction`/`share_pct`, item `estimated_monthly_spend`, payment-method breakdown. Contained one bug (`extract()` on an already-integer date difference), reported by the user and fixed in place.
- **016_intelligence_and_payment_depth.sql** — category monthly trend, merchant-category share, weekday spend, expense-type breakdown, card/UPI breakdown.
- **017_receipts.sql** — `expenses.receipt_path` column; private `receipts` Storage bucket + household-scoped RLS.
- **018_merge_duplicate_globals.sql** — *(renumbered from a colliding "016" filename found on the device)* — allows merging duplicate global default categories/merchants, which the original migration 011 blocked.

All four are idempotent SQL files only — none have been run against the live Supabase project. Run them in numeric order (015 → 016 → 017 → 018) via the SQL Editor; see `supabase/migrations/README.md` for the full dependency notes.

## Known gaps, honestly stated

- No literal "budget pacing" label/copy distinct from the forecast — the underlying pace math already exists (`projectedSpend`) and is displayed, just not named "pacing" in the UI.
- Full QA suite, `audit.mjs`, full test suite, and production build have not been run this phase, per standing policy — only `tsc --noEmit` and targeted `eslint` on touched files.
- Migrations 015–018 have not been executed against the live Supabase project; that remains the user's manual step.
- A color-contrast/WCAG audit has not been performed (carried over from the prior Premium UX phase report) — needs real rendering tooling, not something safely verifiable by reading code alone.
