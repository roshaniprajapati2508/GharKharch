// Natural-language quick entry (spec section 45, 83). Deterministic parsing
// only — "This can initially use deterministic parsing. AI can be added
// later," and per spec section 88, AI must never be responsible for core
// financial calculations, so the amount/date extraction here never goes
// through an LLM even when one is configured (see lib/ai/expense-parser.ts,
// which explains a result like this one rather than re-deriving it).
//
// Examples this parses:
//   "Milk 60"                 -> { itemName: "Milk", amount: 60 }
//   "Zudio 1499"               -> { itemName: "Zudio", amount: 1499 }
//   "Vegetables 240 cash"      -> { itemName: "Vegetables", amount: 240, paymentMethod: "Cash" }
//   "Croma 18999 card"         -> { itemName: "Croma", amount: 18999, paymentMethod: "Credit Card" }
//   "Petrol 1000 yesterday"    -> { itemName: "Petrol", amount: 1000, expenseDate: <yesterday> }

import { getTodayISO, addDaysISO } from "@/lib/date-utils";

export interface ParsedQuickEntry {
  itemName: string;
  amount: number | null;
  paymentMethod: string | null;
  expenseDate: string;
  /** Words the parser couldn't confidently place — surfaced so the UI can show what was ignored rather than silently dropping it. */
  unmatchedTokens: string[];
}

const PAYMENT_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(credit card|creditcard)\b/i, label: "Credit Card" },
  { pattern: /\b(debit card|debitcard)\b/i, label: "Debit Card" },
  { pattern: /\bcard\b/i, label: "Credit Card" },
  { pattern: /\bupi\b/i, label: "UPI" },
  { pattern: /\bcash\b/i, label: "Cash" },
  { pattern: /\b(net ?banking|bank transfer)\b/i, label: "Bank Transfer" },
  { pattern: /\bwallet\b/i, label: "Wallet" },
];

const DATE_KEYWORDS: { pattern: RegExp; resolve: () => string }[] = [
  { pattern: /\btoday\b/i, resolve: getTodayISO },
  { pattern: /\byesterday\b/i, resolve: () => addDaysISO(getTodayISO(), -1) },
];

const AMOUNT_PATTERN = /₹?\s*(\d[\d,]*(?:\.\d{1,2})?)/;

export function parseQuickEntry(input: string): ParsedQuickEntry {
  let remaining = input.trim();
  let paymentMethod: string | null = null;
  let expenseDate = getTodayISO();

  for (const { pattern, resolve } of DATE_KEYWORDS) {
    if (pattern.test(remaining)) {
      expenseDate = resolve();
      remaining = remaining.replace(pattern, " ");
      break;
    }
  }

  for (const { pattern, label } of PAYMENT_KEYWORDS) {
    if (pattern.test(remaining)) {
      paymentMethod = label;
      remaining = remaining.replace(pattern, " ");
      break;
    }
  }

  let amount: number | null = null;
  const amountMatch = remaining.match(AMOUNT_PATTERN);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    remaining = remaining.replace(amountMatch[0], " ");
  }

  const itemName = remaining.replace(/\s+/g, " ").trim();

  return {
    itemName,
    amount,
    paymentMethod,
    expenseDate,
    unmatchedTokens: [],
  };
}
