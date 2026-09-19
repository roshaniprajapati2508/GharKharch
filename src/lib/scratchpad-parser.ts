// Fast Expense Scratchpad line parser (spec: Feature 1). Pure/client-safe,
// 0ms - no network calls. Each non-empty line of freeform shorthand
// ("Xerox 150 satyam upi") is broken into its raw tokens here, then
// `resolveScratchpadLine` maps those tokens onto real category/merchant/
// payer ids the same way the Smart Rules engine resolves rule actions
// (expense-intelligence/automation-rules.ts) - by NAME, against whatever
// category tree / merchant list / household members are already loaded in
// the sheet, never a second round trip per line.

import { matchKeywordRule } from "@/lib/expense-intelligence/keyword-map";
import { suggestMerchant } from "@/lib/expense-intelligence/merchant-suggester";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { Tables } from "@/types/database";

const PAYMENT_KEYWORDS: { keyword: string; label: string }[] = [
  { keyword: "gpay", label: "UPI" },
  { keyword: "googlepay", label: "UPI" },
  { keyword: "phonepe", label: "UPI" },
  { keyword: "paytm", label: "UPI" },
  { keyword: "upi", label: "UPI" },
  { keyword: "cash", label: "Cash" },
  { keyword: "card", label: "Credit Card" },
  { keyword: "bank", label: "Bank Transfer" },
];

const INCOME_KEYWORDS = ["income", "payout", "sale", "salary"];

export interface ParsedScratchpadLine {
  lineNumber: number;
  raw: string;
  amount: number | null;
  itemName: string;
  paymentMethod: string | null;
  paidByName: string | null;
  entryType: "expense" | "income";
  /** Keyword-map fallback guess (spec step 6) - may be null if nothing matched. */
  categoryName: string | null;
  subcategoryName: string | null;
}

/** Extracts the first numeric token (e.g. "40", "150.50") as the amount, and returns the line with that token removed. */
function extractAmount(text: string): { amount: number | null; rest: string } {
  const match = text.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  if (!match) return { amount: null, rest: text };
  const amount = parseFloat(match[1]);
  const rest = (text.slice(0, match.index) + " " + text.slice((match.index ?? 0) + match[0].length)).trim();
  return { amount: Number.isFinite(amount) ? amount : null, rest };
}

/** Removes every whole-word occurrence of `word` from `text` (case-insensitive), collapsing extra whitespace. */
function stripWord(text: string, word: string): string {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}

/** Parses one freeform shorthand line into its raw semantic tokens (spec steps 1-5). Does not touch the network or resolve real ids - see resolveScratchpadLine for that. */
export function parseScratchpadLine(raw: string, lineNumber: number): ParsedScratchpadLine {
  let text = raw.trim();

  // 1. Amount
  const { amount, rest: afterAmount } = extractAmount(text);
  text = afterAmount;

  // 2. Payment method
  let paymentMethod: string | null = null;
  for (const { keyword, label } of PAYMENT_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(text)) {
      paymentMethod = label;
      text = stripWord(text, keyword);
      break;
    }
  }

  // 3. Payer/receiver
  let paidByName: "Harsh" | "Roshni" | null = null;
  if (/\bharsh\b/i.test(text)) {
    paidByName = "Harsh";
    text = stripWord(text, "harsh");
  } else if (/\broshni\b/i.test(text)) {
    paidByName = "Roshni";
    text = stripWord(text, "roshni");
  }

  // 4. Entry type
  let entryType: "expense" | "income" = "expense";
  for (const kw of INCOME_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(text)) {
      entryType = "income";
      text = stripWord(text, kw);
      break;
    }
  }

  // 5. Whatever tokens remain form the item name.
  const itemName = text.trim() || raw.trim();

  // 6. Intelligence mapping - static keyword fallback (category-suggester's
  // tier 4). A per-household usage-history match (tiers 1-3) needs a
  // server round trip per line, which would defeat the point of a fast,
  // 0ms multi-line parser - the review table lets the user correct any
  // miss before saving anyway.
  const keywordMatch = matchKeywordRule(itemName);

  return {
    lineNumber,
    raw,
    amount,
    itemName,
    paymentMethod,
    paidByName,
    entryType,
    categoryName: keywordMatch?.categoryName ?? null,
    subcategoryName: keywordMatch?.subcategoryName ?? null,
  };
}

/** Splits raw scratchpad text into non-empty lines and parses each (spec section 3). */
export function parseScratchpadText(text: string): ParsedScratchpadLine[] {
  return text
    .split("\n")
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, i }) => parseScratchpadLine(line, i + 1));
}

export interface ResolvedScratchpadRow {
  lineNumber: number;
  raw: string;
  amount: number | null;
  itemName: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  merchantId: string | null;
  merchantName: string | null;
  paidBy: string;
  paymentMethod: string;
  entryType: "expense" | "income";
}

/** Resolves one parsed line's names into real ids for this household - same "resolve by name against already-loaded data" pattern as the Smart Rules engine. Falls back to the current user as payer and "UPI" as payment method when the line didn't specify one, so every row is save-ready without forcing the user to fill in defaults by hand. */
export function resolveScratchpadLine(
  parsed: ParsedScratchpadLine,
  categoryTree: CategoryWithChildren[],
  merchants: Tables<"merchants">[],
  members: { id: string; displayName: string }[],
  currentUserId: string
): ResolvedScratchpadRow {
  let categoryId: string | null = null;
  let subcategoryId: string | null = null;
  let resolvedCategoryName = parsed.categoryName;
  let resolvedSubcategoryName = parsed.subcategoryName;

  if (parsed.categoryName) {
    const parent = categoryTree.find((c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase());
    if (parent) {
      categoryId = parent.id;
      resolvedCategoryName = parent.name;
      if (parsed.subcategoryName) {
        const sub = parent.children.find((c) => c.name.toLowerCase() === parsed.subcategoryName!.toLowerCase());
        if (sub) {
          subcategoryId = sub.id;
          resolvedSubcategoryName = sub.name;
        }
      }
    }
  }

  const merchantMatch = suggestMerchant(parsed.itemName, merchants);
  const merchant = merchantMatch && merchantMatch.confidence >= 0.7 ? merchantMatch.merchant : null;
  let payer = parsed.paidByName
    ? members.find((m) => m.displayName.toLowerCase().includes(parsed.paidByName!.toLowerCase()) || parsed.paidByName!.toLowerCase().includes(m.displayName.toLowerCase()))
    : null;

  if (!payer && parsed.raw) {
    for (const m of members) {
      const firstName = m.displayName.split(" ")[0].toLowerCase();
      if (firstName.length >= 2 && new RegExp(`\\b${firstName}\\b`, "i").test(parsed.raw)) {
        payer = m;
        break;
      }
    }
  }

  return {
    lineNumber: parsed.lineNumber,
    raw: parsed.raw,
    amount: parsed.amount,
    itemName: parsed.itemName,
    categoryId,
    categoryName: resolvedCategoryName,
    subcategoryId,
    subcategoryName: resolvedSubcategoryName,
    merchantId: merchant?.id ?? null,
    merchantName: merchant?.name ?? null,
    paidBy: payer?.id ?? currentUserId,
    paymentMethod: parsed.paymentMethod ?? "UPI",
    entryType: parsed.entryType,
  };
}
