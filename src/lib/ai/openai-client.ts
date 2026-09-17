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

/**
 * Sibling to `requestAiCompletion` for a single image + text prompt (receipt
 * scanning, spec section 3). `gpt-4o-mini` accepts an `image_url` content
 * part alongside text in the same Chat Completions endpoint used everywhere
 * else in this file — no new endpoint, no SDK. `imageDataUrl` must already be
 * a `data:image/...;base64,...` URL (the caller reads the picked file into
 * one client-side); this function never fetches or stores the image itself.
 * Same contract as `requestAiCompletion`: returns null (never throws) on a
 * missing key or any failure, so every caller must have a deterministic
 * fallback (here: falling back to the plain "Attach receipt" flow with no
 * extracted fields).
 */
export async function requestAiVisionCompletion(imageDataUrl: string, prompt: string): Promise<string | null> {
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
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
      // Vision requests run a little slower than a plain text completion.
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}
