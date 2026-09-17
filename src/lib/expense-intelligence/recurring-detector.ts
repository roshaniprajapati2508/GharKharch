// Recurring-expense detection (spec section 11). Pure function over the rows
// from get_item_gap_consistency (migration 010) — never writes anything
// itself. Per spec section 88 ("do NOT automatically invent transactions from
// recurring patterns"), this only ever produces a dismiss-able suggestion;
// turning one into an actual `recurring_expenses` row is always a separate,
// explicit user action (see actions/intelligence.ts's
// createRecurringExpenseFromCandidate).

import type { Database } from "@/types/database";
import type { RecurringFrequency } from "@/types/database";

type GapRow = Database["public"]["Functions"]["get_item_gap_consistency"]["Returns"][number];

export interface RecurringCandidate {
  itemName: string;
  txnCount: number;
  avgGapDays: number;
  suggestedFrequency: RecurringFrequency;
  cadenceLabel: string; // e.g. "every 1-2 days"
  amount: number;
  merchantId: string | null;
  categoryId: string | null;
  lastDate: string;
}

function frequencyFor(avgGapDays: number): RecurringFrequency {
  if (avgGapDays <= 2) return "daily";
  if (avgGapDays >= 5 && avgGapDays <= 10) return "weekly";
  if (avgGapDays >= 25 && avgGapDays <= 35) return "monthly";
  if (avgGapDays >= 350 && avgGapDays <= 380) return "yearly";
  return "custom";
}

function cadenceLabel(avgGapDays: number, stddevDays: number): string {
  if (avgGapDays < 1) return "almost daily";
  const low = Math.max(1, Math.round(avgGapDays - stddevDays));
  const high = Math.round(avgGapDays + stddevDays);
  if (low === high) return `every ${low} day${low === 1 ? "" : "s"}`;
  return `every ${low}-${high} days`;
}

/**
 * Flags items as recurring-like when their purchase gap is both short enough
 * to matter and consistent enough to trust (coefficient of variation below
 * `maxCoefficientOfVariation`) — a plain, explainable rule rather than a
 * fabricated statistical claim.
 */
export function detectRecurringCandidates(
  rows: GapRow[],
  alreadyRecurringNames: Set<string>,
  options: { maxCoefficientOfVariation?: number; maxAvgGapDays?: number; limit?: number } = {}
): RecurringCandidate[] {
  const maxCv = options.maxCoefficientOfVariation ?? 0.6;
  const maxGap = options.maxAvgGapDays ?? 400;

  return rows
    .filter((r) => !alreadyRecurringNames.has(r.item_name.toLowerCase()))
    .map((r) => ({ ...r, avg: parseFloat(r.avg_gap_days), stddev: parseFloat(r.gap_stddev_days) }))
    .filter((r) => r.avg > 0 && r.avg <= maxGap && r.stddev / r.avg <= maxCv)
    .map(
      (r): RecurringCandidate => ({
        itemName: r.item_name,
        txnCount: r.txn_count,
        avgGapDays: r.avg,
        suggestedFrequency: frequencyFor(r.avg),
        cadenceLabel: cadenceLabel(r.avg, r.stddev),
        amount: parseFloat(r.avg_amount),
        merchantId: r.merchant_id,
        categoryId: r.category_id,
        lastDate: r.last_date,
      })
    )
    .sort((a, b) => b.txnCount - a.txnCount)
    .slice(0, options.limit ?? 10);
}
