"use server";

// Server-action wrapper around the AI receipt scanner (spec section 3). Kept
// separate from lib/ai/receipt-parser.ts (a plain module, no DB/auth access —
// same split as lib/ai/expense-parser.ts vs. the actions that call it) so the
// AI file itself stays impossible to accidentally wire to anything but a
// review screen.

import { runAction, ActionError } from "@/lib/actions/auth-helpers";
import { isAiConfigured } from "@/lib/ai/openai-client";
import { parseReceiptImage, type ParsedReceipt } from "@/lib/ai/receipt-parser";

/**
 * Whether AI receipt scanning is available at all (an `OPENAI_API_KEY` is
 * configured). A plain `"use server"` action rather than exporting
 * `isAiConfigured` directly — that reads `process.env.OPENAI_API_KEY`, which
 * a client bundle can't see (it's not a `NEXT_PUBLIC_` var), and a
 * `"use server"` file may only export async functions. The "Scan receipt"
 * entry point calls this once on mount to decide whether to show itself.
 */
export async function checkAiConfigured() {
  return runAction(async () => isAiConfigured());
}

/**
 * Scans a receipt photo and returns best-effort extracted fields — never
 * saved anywhere by this action. The caller (receipt-review-sheet.tsx) always
 * shows every field in an editable form and hands off into the normal Add
 * Expense flow; this action has no household/database access at all, only
 * the image data URL the user just picked.
 */
export async function scanReceipt(imageDataUrl: string) {
  return runAction(async (): Promise<ParsedReceipt> => {
    if (!isAiConfigured()) throw new ActionError("Receipt scanning isn't configured");
    const parsed = await parseReceiptImage(imageDataUrl);
    if (!parsed) throw new ActionError("Couldn't read that receipt clearly — try a clearer photo, or enter it manually");
    return parsed;
  });
}
