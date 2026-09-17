// Optional AI-assisted fallback for natural-language quick entry (spec
// section 47's lib/ai/ file list). The deterministic parser in
// expense-intelligence/nl-parser.ts is always tried first and is the ONLY
// thing that ever runs when no AI key is configured (spec section 45: "This
// can initially use deterministic parsing"). This file exists purely to
// widen the phrasing the feature understands ("spent 500 on milk at DMart
// yesterday", where the amount isn't the last token the regex parser
// expects) when the deterministic parser can't confidently find an amount.
//
// It is never the only path, and it never invents an amount (spec section
// 46, 88): the AI's own extracted amount is validated as a positive finite
// number before use, and any failure — missing key, network error, bad
// JSON, missing/invalid amount — falls back to the deterministic result
// untouched. The user still sees every field in the Add Expense form before
// saving, so an AI misread is always caught before it becomes a transaction.

import { isAiConfigured, requestAiCompletion } from "@/lib/ai/openai-client";
import { parseQuickEntry, type ParsedQuickEntry } from "@/lib/expense-intelligence/nl-parser";
import { getTodayISO, addDaysISO } from "@/lib/date-utils";

export interface AiParsedQuickEntry extends ParsedQuickEntry {
  source: "deterministic" | "ai-assisted";
}

const EXTRACT_SYSTEM_PROMPT = `Extract a single household expense from the user's text. Respond with ONLY compact JSON, no prose, in exactly this shape:
{"itemName": string, "amount": number | null, "paymentMethod": "Cash" | "Credit Card" | "Debit Card" | "UPI" | "Bank Transfer" | "Wallet" | null, "daysAgo": number}
"daysAgo" is 0 for today, 1 for yesterday, etc — default 0 if not mentioned. If you cannot find a clear amount in the text, set "amount" to null. Never guess or estimate an amount that isn't written in the text.`;

interface ExtractedFields {
  itemName: string;
  amount: number | null;
  paymentMethod: string | null;
  daysAgo: number;
}

function tryParseAiJson(raw: string): ExtractedFields | null {
  try {
    // Models sometimes wrap JSON in a code fence despite instructions not to — strip it defensively.
    const cleaned = raw
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof parsed.itemName !== "string" || !parsed.itemName.trim()) return null;

    const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0 ? parsed.amount : null;
    const daysAgo = typeof parsed.daysAgo === "number" && Number.isFinite(parsed.daysAgo) ? Math.max(0, Math.round(parsed.daysAgo)) : 0;
    const paymentMethod = typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : null;

    return { itemName: parsed.itemName.trim(), amount, paymentMethod, daysAgo };
  } catch {
    return null;
  }
}

/**
 * Parses free-text quick entry, trying the deterministic parser first and
 * only calling the AI when it left the amount unresolved (the one signal
 * that the phrasing was too free-form for the regex parser) and a key is
 * configured. Returns the deterministic result untouched in every other
 * case, including any AI failure.
 */
export async function parseExpenseWithAi(input: string): Promise<AiParsedQuickEntry> {
  const deterministic = parseQuickEntry(input);
  if (deterministic.amount !== null || !isAiConfigured()) {
    return { ...deterministic, source: "deterministic" };
  }

  const aiText = await requestAiCompletion([
    { role: "system", content: EXTRACT_SYSTEM_PROMPT },
    { role: "user", content: input },
  ]);
  if (!aiText) return { ...deterministic, source: "deterministic" };

  const extracted = tryParseAiJson(aiText);
  if (!extracted || extracted.amount === null) return { ...deterministic, source: "deterministic" };

  return {
    itemName: extracted.itemName || deterministic.itemName,
    amount: extracted.amount,
    paymentMethod: extracted.paymentMethod,
    expenseDate: addDaysISO(getTodayISO(), -extracted.daysAgo),
    unmatchedTokens: [],
    source: "ai-assisted",
  };
}
