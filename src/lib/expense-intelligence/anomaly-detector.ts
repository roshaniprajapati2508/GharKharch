// Spending anomaly detection (spec section 28). Pure, threshold-based, and
// deliberately conservative: it compares an expense against the historical
// norms GharKharch already aggregates in Postgres (get_merchant_breakdown /
// get_category_breakdown's avg + highest transaction), rather than fetching
// raw history to compute a proper z-score. Per spec: "Do NOT make alarming
// financial claims. Use neutral language."

export interface AnomalyCheckInput {
  itemName: string;
  amount: number;
  merchantName: string | null;
  merchantAvg: number | null;
  merchantHighest: number | null;
  categoryName: string | null;
  categoryAvg: number | null;
  categoryHighest: number | null;
}

export interface Anomaly {
  itemName: string;
  amount: number;
  message: string;
  compareLabel: string;
}

const ANOMALY_MULTIPLIER = 2.5;
const MIN_HISTORY_TXNS = 3;

/**
 * Flags `amount` as unusual when it's well beyond both the historical average
 * AND the historical highest for that merchant (falling back to category when
 * there's no merchant), so a single one-off big purchase at a brand-new
 * merchant doesn't get flagged just for having no history to compare against.
 */
export function checkAnomaly(input: AnomalyCheckInput, historicalTxnCount: number): Anomaly | null {
  if (historicalTxnCount < MIN_HISTORY_TXNS) return null;

  if (input.merchantName && input.merchantAvg && input.merchantHighest) {
    if (input.amount > input.merchantAvg * ANOMALY_MULTIPLIER && input.amount > input.merchantHighest) {
      return {
        itemName: input.itemName,
        amount: input.amount,
        message: `This is significantly higher than your usual ${input.merchantName} spending.`,
        compareLabel: `Usual range up to ₹${Math.round(input.merchantHighest).toLocaleString("en-IN")}`,
      };
    }
    return null;
  }

  if (input.categoryName && input.categoryAvg && input.categoryHighest) {
    if (input.amount > input.categoryAvg * ANOMALY_MULTIPLIER && input.amount > input.categoryHighest) {
      return {
        itemName: input.itemName,
        amount: input.amount,
        message: `This is significantly higher than your usual ${input.categoryName} spending.`,
        compareLabel: `Usual range up to ₹${Math.round(input.categoryHighest).toLocaleString("en-IN")}`,
      };
    }
  }

  return null;
}
