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

const PAYMENT_KEYWORDS: { pattern: RegExp; label: string; rawWords: string[] }[] = [
  { pattern: /\b(google\s*pay|gpay)\b/i, label: "UPI", rawWords: ["google pay", "googlepay", "gpay"] },
  { pattern: /\b(phone\s*pe|phonepe)\b/i, label: "UPI", rawWords: ["phone pe", "phonepe"] },
  { pattern: /\b(paytm)\b/i, label: "UPI", rawWords: ["paytm"] },
  { pattern: /\b(upi)\b/i, label: "UPI", rawWords: ["upi"] },
  { pattern: /\b(cash|rokda)\b/i, label: "Cash", rawWords: ["cash", "rokda"] },
  { pattern: /\b(credit\s*card|debit\s*card|card)\b/i, label: "Credit Card", rawWords: ["credit card", "debit card", "card"] },
  { pattern: /\b(bank\s*transfer|netbanking|neft|rtgs|imps|bank)\b/i, label: "Bank Transfer", rawWords: ["bank transfer", "netbanking", "neft", "rtgs", "imps", "bank"] },
];

const INCOME_KEYWORDS = [
  /\b(income)\b/i,
  /\b(payout|payouts)\b/i,
  /\b(salary|payroll)\b/i,
  /\b(sale|sales)\b/i,
  /\b(refund|refunds)\b/i,
  /\b(cashback)\b/i,
  /\b(interest)\b/i,
];

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

/** Extracts numeric amount (handles prefix ₹/Rs/INR and suffix /-, rs, etc.) and returns remaining text. */
function extractAmount(text: string): { amount: number | null; rest: string } {
  // Matches "₹150", "Rs 150", "Rs. 150", "150/-", "150rs", "150.50", "150"
  const match = text.match(/(?:^|\s)(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)(?:\s*(?:\/\-|rs|inr|rupees))?(?:\s|$)/i);
  if (!match) return { amount: null, rest: text };

  const parsed = parseFloat(match[1]);
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const rest = (text.slice(0, match.index) + " " + text.slice((match.index ?? 0) + match[0].length)).replace(/\s+/g, " ").trim();
  return { amount, rest };
}

/** Removes matching words/phrases from text (case-insensitive) and collapses whitespace. */
function stripPattern(text: string, pattern: RegExp): string {
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

/** Parses one freeform shorthand line into its raw semantic tokens. */
export function parseScratchpadLine(raw: string, lineNumber: number): ParsedScratchpadLine {
  let text = raw.trim();

  // 1. Amount
  const { amount, rest: afterAmount } = extractAmount(text);
  text = afterAmount;

  // 2. Entry type (income vs expense)
  let entryType: "expense" | "income" = "expense";
  for (const pattern of INCOME_KEYWORDS) {
    if (pattern.test(text)) {
      entryType = "income";
      text = stripPattern(text, pattern);
      break;
    }
  }

  // 3. Payment method
  let paymentMethod: string | null = null;
  for (const { pattern, label } of PAYMENT_KEYWORDS) {
    if (pattern.test(text)) {
      paymentMethod = label;
      text = stripPattern(text, pattern);
      break;
    }
  }

  // 4. Payer/receiver keywords
  let paidByName: "Harsh" | "Roshni" | null = null;
  if (/\b(harsh)\b/i.test(text)) {
    paidByName = "Harsh";
    text = stripPattern(text, /\b(harsh)\b/i);
  } else if (/\b(roshni|rosh)\b/i.test(text)) {
    paidByName = "Roshni";
    text = stripPattern(text, /\b(roshni|rosh)\b/i);
  }

  // 5. Remaining text forms the clean item name
  let itemName = text.trim() || raw.trim();

  // 6. Intelligent keyword category match
  const keywordMatch = matchKeywordRule(itemName) || matchKeywordRule(raw);

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

/** Splits raw scratchpad text into non-empty lines and parses each. */
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

/** Resolves one parsed line's names into real ids for this household against already-loaded data. */
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

  // 1. Merchant suggestion
  const merchantMatch = suggestMerchant(parsed.itemName, merchants) || suggestMerchant(parsed.raw, merchants);
  const merchant = merchantMatch && merchantMatch.confidence >= 0.6 ? merchantMatch.merchant : null;

  // 2. If no category found yet, try matching merchant name or item name directly in categoryTree
  if (!resolvedCategoryName) {
    if (merchant) {
      const merchantRule = matchKeywordRule(merchant.name);
      if (merchantRule) {
        resolvedCategoryName = merchantRule.categoryName;
        resolvedSubcategoryName = merchantRule.subcategoryName ?? null;
      }
    }
  }

  // 3. Match against loaded categoryTree
  if (resolvedCategoryName) {
    const parent = categoryTree.find(
      (c) => c.name.toLowerCase() === resolvedCategoryName!.toLowerCase() ||
             c.name.toLowerCase().includes(resolvedCategoryName!.toLowerCase())
    );
    if (parent) {
      categoryId = parent.id;
      resolvedCategoryName = parent.name;
      if (resolvedSubcategoryName) {
        const sub = parent.children.find(
          (c) => c.name.toLowerCase() === resolvedSubcategoryName!.toLowerCase() ||
                 c.name.toLowerCase().includes(resolvedSubcategoryName!.toLowerCase())
        );
        if (sub) {
          subcategoryId = sub.id;
          resolvedSubcategoryName = sub.name;
        }
      }
    }
  } else {
    // Check if item name directly names a category (e.g. "shopping", "groceries", "transport", "food")
    const lowerItem = parsed.itemName.toLowerCase();
    const directCat = categoryTree.find(
      (c) => c.name.toLowerCase() === lowerItem ||
             lowerItem.includes(c.name.toLowerCase()) ||
             c.name.toLowerCase().split("&").some((part) => lowerItem.includes(part.trim().toLowerCase()))
    );
    if (directCat) {
      categoryId = directCat.id;
      resolvedCategoryName = directCat.name;
    }
  }

  // 4. Resolve Payer
  let payer = parsed.paidByName
    ? members.find(
        (m) =>
          m.displayName.toLowerCase().includes(parsed.paidByName!.toLowerCase()) ||
          parsed.paidByName!.toLowerCase().includes(m.displayName.toLowerCase())
      )
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
