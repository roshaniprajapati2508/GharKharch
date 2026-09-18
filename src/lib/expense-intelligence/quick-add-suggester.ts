// Quick Add ranking (spec section 9, 10, 80). Pure scoring over already-fetched
// `expense_patterns` rows - the only DB reads live in the calling server
// action (actions/quick-add.ts), matching every other file in this folder.
//
//   score = (recencyScore     * 0.30
//          + frequencyScore   * 0.30
//          + weekdayPattern   * 0.15
//          + userPreference   * 0.15
//          + merchantFrequency* 0.10)
//          * (1 + timeOfDayBoost)
//
// timeOfDayBoost (see time-of-day.ts) re-ranks candidates by the household's
// actual daily rhythm - e.g. Food & Grocery patterns get a lift in the
// morning, Homemade Business during the day - as a final multiplier on the
// base score, so it re-orders close calls without ever overriding a strong
// recency/frequency signal on its own.
//
// The spec calls this a starting point ("this can evolve later") - the goal
// is that Quick Add visibly learns from real usage rather than staying static.

import { timeOfDayCategoryBoost } from "./time-of-day";

export interface QuickAddPatternInput {
  item_name: string;
  merchant_id: string | null;
  category_id: string;
  subcategory_id: string | null;
  average_amount: string | null;
  usage_count: number;
  last_used_at: string | null;
  user_id: string | null;
}

/** Top-level category name for a pattern's `category_id`, used only for the time-of-day boost - resolved by the caller since names live in a separate table. */
export type CategoryNameLookup = Map<string, string>;

export interface QuickAddCandidate {
  itemName: string;
  merchantId: string | null;
  categoryId: string;
  subcategoryId: string | null;
  amount: number;
  score: number;
}

function recencyScore(lastUsedAt: string | null, now: number): number {
  if (!lastUsedAt) return 0;
  const daysSince = (now - new Date(lastUsedAt).getTime()) / 86_400_000;
  return Math.max(0, 1 - daysSince / 30);
}

/**
 * Ranks `expense_patterns` rows into Quick Add candidates.
 * `weekdayAffinity` maps normalized item_name -> 0..1 (fraction of that
 * item's purchases historically falling on today's weekday; see
 * get_item_weekday_affinity). Missing entries score 0 for that term, not a
 * penalty - most items simply don't have a strong weekday signal yet.
 */
export function rankQuickAddCandidates(
  patterns: QuickAddPatternInput[],
  options: {
    currentUserId: string;
    weekdayAffinity: Map<string, number>;
    /** category_id -> top-level category name, for the time-of-day boost. Omit to skip the boost entirely (it defaults to a no-op). */
    categoryNames?: CategoryNameLookup;
    now?: number;
    limit?: number;
  }
): QuickAddCandidate[] {
  if (patterns.length === 0) return [];
  const now = options.now ?? Date.now();

  const maxUsage = Math.max(1, ...patterns.map((p) => p.usage_count));
  const merchantTotals = new Map<string, number>();
  for (const p of patterns) {
    if (!p.merchant_id) continue;
    merchantTotals.set(p.merchant_id, (merchantTotals.get(p.merchant_id) ?? 0) + p.usage_count);
  }
  const maxMerchantTotal = Math.max(1, ...Array.from(merchantTotals.values()));

  const scored = patterns.map((p) => {
    const recency = recencyScore(p.last_used_at, now);
    const frequency = p.usage_count / maxUsage;
    const weekday = options.weekdayAffinity.get(p.item_name.toLowerCase()) ?? 0;
    const userPreference = p.user_id === options.currentUserId ? 1 : 0.6;
    const merchantFrequency = p.merchant_id ? (merchantTotals.get(p.merchant_id) ?? 0) / maxMerchantTotal : 0;

    const baseScore = recency * 0.3 + frequency * 0.3 + weekday * 0.15 + userPreference * 0.15 + merchantFrequency * 0.1;
    const categoryName = options.categoryNames?.get(p.category_id);
    const boost = timeOfDayCategoryBoost(categoryName, now);
    const score = baseScore * (1 + boost);

    return {
      itemName: p.item_name,
      merchantId: p.merchant_id,
      categoryId: p.category_id,
      subcategoryId: p.subcategory_id,
      amount: p.average_amount ? parseFloat(p.average_amount) : 0,
      score,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, options.limit ?? 8);
}
