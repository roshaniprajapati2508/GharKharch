// Time-of-day contextual boost (spec: "Temporal Time & Day Affinity" /
// Task 2 "Time-of-Day Contextual Prioritizer"). A small, pure helper so
// both the Quick Add ranker (quick-add-suggester.ts) and the Add Expense
// predictive typeahead (add-expense-sheet.tsx) apply the exact same rule
// rather than each guessing their own thresholds.
//
// This is intentionally coarse (three buckets, one category name each) -
// it's a light tiebreaker/re-ranking signal, not a replacement for the
// recency/frequency/history signals that already do the real work.

/** Current hour in IST as a fraction (e.g. 18:30 -> 18.5), from a UTC epoch ms timestamp. */
export function istFractionalHour(nowMs: number): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(nowMs + IST_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export type TimeOfDayBucket = "morning" | "business" | "evening" | "other";

/** Which part of the day `nowMs` (a UTC epoch ms timestamp) falls into, in IST. */
export function timeOfDayBucket(nowMs: number): TimeOfDayBucket {
  const hour = istFractionalHour(nowMs);
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 18.5) return "business";
  if (hour >= 18.5 && hour < 23) return "evening";
  return "other";
}

/**
 * Fractional boost (e.g. 0.3 = +30%) for a top-level category name at the
 * given time, matching the household's actual daily rhythm:
 *  - Morning (6-11 IST): Food & Grocery (milk, nasto, breakfast items).
 *  - Business hours (11-18:30 IST): Homemade Business (courier, xerox/book
 *    stock, LuxeKraft, mehndi bookings).
 *  - Evening (18:30-23 IST): Food & Grocery again (vegetables, dinner
 *    groceries) and Entertainment (dining out).
 * Returns 0 outside these windows/categories - callers apply it as a
 * multiplier (`score * (1 + boost)`), so 0 is a true no-op.
 */
export function timeOfDayCategoryBoost(categoryName: string | null | undefined, nowMs: number = Date.now()): number {
  if (!categoryName) return 0;
  const bucket = timeOfDayBucket(nowMs);

  if (bucket === "morning" && categoryName === "Food & Grocery") return 0.3;
  if (bucket === "business" && categoryName === "Homemade Business") return 0.3;
  if (bucket === "evening" && (categoryName === "Food & Grocery" || categoryName === "Entertainment")) return 0.3;

  return 0;
}
