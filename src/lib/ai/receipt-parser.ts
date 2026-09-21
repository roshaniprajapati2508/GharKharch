// AI-assisted receipt scanning (spec section 3). Same defensive-JSON pattern
// as expense-parser.ts, and the same non-negotiable rule (spec section 46,
// 88): this file never creates a transaction and never decides anything -
// it only turns a receipt photo into a best-effort set of *suggested* field
// values, every one of which the caller (receipt-review-sheet.tsx) shows in
// normal, editable form inputs before anything is saved via the ordinary
// Add Expense flow. A field this module can't validate is left out rather
// than guessed at.

import { requestAiVisionCompletion } from "@/lib/ai/openai-client";

const RECEIPT_SYSTEM_PROMPT = `You are reading a photo of a shopping/restaurant receipt. Extract the following and respond with ONLY compact JSON, no prose, no code fences, in exactly this shape:
{"merchant": string | null, "amount": number | null, "date": string | null, "items": string[], "categoryGuess": string | null}
- "amount" is the final total paid, as a plain number (no currency symbol). If you cannot clearly read a total, use null - never estimate or guess one.
- "date" is the receipt's date in YYYY-MM-DD format if visible, else null.
- "items" is a short list of line-item names actually printed on the receipt (up to 10). Empty array if none are legible.
- "categoryGuess" is a single short household-expense category word (e.g. "Grocery", "Food & Dining", "Fuel", "Shopping", "Health") that best fits this receipt, or null if unclear. This is only a hint - never invent one you're not reasonably confident about.
Never fabricate a value that isn't actually visible in the image.`;

export interface ParsedReceipt {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: string[];
  categoryGuess: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function tryParseReceiptJson(raw: string): ParsedReceipt | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const merchant = typeof parsed.merchant === "string" && parsed.merchant.trim() ? parsed.merchant.trim().slice(0, 120) : null;
    const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0 ? parsed.amount : null;
    const date = typeof parsed.date === "string" && DATE_RE.test(parsed.date) ? parsed.date : null;
    const items = Array.isArray(parsed.items) ? parsed.items.filter((i): i is string => typeof i === "string" && i.trim().length > 0).slice(0, 10) : [];
    const categoryGuess = typeof parsed.categoryGuess === "string" && parsed.categoryGuess.trim() ? parsed.categoryGuess.trim().slice(0, 60) : null;

    // A receipt with none of merchant/amount/items readable isn't a useful extraction - treat it as a failure so the caller falls back to a fully-blank manual entry rather than an empty "review" screen that looks broken.
    if (!merchant && amount === null && items.length === 0) return null;

    return { merchant, amount, date, items, categoryGuess };
  } catch {
    return null;
  }
}

/** Returns null (never throws) on a missing key, a network failure, or unparseable/empty output - callers must always be ready to fall back to a blank manual entry. */
export async function parseReceiptImage(imageDataUrl: string): Promise<ParsedReceipt | null> {
  const aiText = await requestAiVisionCompletion(imageDataUrl, RECEIPT_SYSTEM_PROMPT);
  if (!aiText) return null;
  return tryParseReceiptJson(aiText);
}
