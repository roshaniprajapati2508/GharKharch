// Merchant suggestion (spec section 12, 83): given free text (an item-name
// field, or a natural-language quick-entry string), find the best-matching
// known merchant so the UI can offer "Did you mean Zudio?" without the user
// having to open the merchant picker.

import type { Tables } from "@/types/database";

export interface MerchantSuggestion {
  merchant: Tables<"merchants">;
  confidence: number;
  reason: string;
}

/** Pure text match - no DB access, so it can run on every keystroke without a round trip. */
export function suggestMerchant(text: string, merchants: Tables<"merchants">[]): MerchantSuggestion | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  let best: MerchantSuggestion | null = null;

  for (const merchant of merchants) {
    const name = merchant.name.toLowerCase();

    if (name === normalized) {
      return { merchant, confidence: 0.99, reason: "Exact match" };
    }

    if (merchant.aliases.some((a) => a.toLowerCase() === normalized)) {
      return { merchant, confidence: 0.95, reason: "Matches a known alias" };
    }

    if (normalized.startsWith(name) || name.startsWith(normalized)) {
      const candidate: MerchantSuggestion = { merchant, confidence: 0.75, reason: "Starts with the same text" };
      if (!best || candidate.confidence > best.confidence) best = candidate;
      continue;
    }

    if (normalized.includes(name) || name.includes(normalized)) {
      const candidate: MerchantSuggestion = { merchant, confidence: 0.55, reason: "Contains a similar name" };
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }
  }

  return best;
}
