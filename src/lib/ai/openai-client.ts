// Minimal OpenAI Chat Completions client — a plain `fetch` call rather than
// the `openai` SDK, since this app only ever needs one simple request shape
// and pulling in a whole SDK for that would be the kind of "unnecessary
// dependency" spec section 88 warns against.
//
// CRITICAL (spec section 46): this file is never given raw database access
// and never asked to compute a number. Callers (lib/ai/insight-generator.ts,
// financial-query.ts) always pass it numbers that were already computed by
// Postgres — its only job is turning those numbers into a sentence.

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Returns null (never throws to the caller) when the API key is missing or the request fails — every caller must have a deterministic fallback ready. */
export async function requestAiCompletion(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 300,
      }),
      // The assistant is a nice-to-have, never a blocking dependency — fail fast.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}
