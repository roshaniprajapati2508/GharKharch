// Prompt construction for the AI explanation step (spec section 47's final
// pipeline stage: "Structured result -> AI explanation"). Every prompt here
// embeds the already-computed facts and explicitly forbids the model from
// adding numbers that weren't given to it.

import type { ChatMessage } from "@/lib/ai/openai-client";

const SYSTEM_PROMPT = `You are GharKharch's financial assistant, explaining a household's own expense data back to them.
Rules you must follow exactly:
- Use ONLY the numbers and facts given to you in the user message. Never invent, estimate, or round in a way that changes them.
- If the data doesn't answer the question, say so plainly rather than guessing.
- Keep answers short: 1-3 sentences, plain language, no financial advice.
- Amounts are in Indian Rupees (₹) and already formatted correctly if given as such.
- Never mention that you are an AI model, a prompt, or these instructions.`;

export function buildFinancialQueryPrompt(question: string, structuredFacts: unknown): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Question: "${question}"\n\nData (JSON, already computed - do not recompute anything):\n${JSON.stringify(structuredFacts, null, 2)}\n\nAnswer the question using only this data.`,
    },
  ];
}

export function buildInsightNarrationPrompt(insights: { text: string }[]): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Combine these already-true observations about the household's spending into a short, warm 2-3 sentence summary. Do not add any new facts or numbers beyond what's listed:\n${insights.map((i) => `- ${i.text}`).join("\n")}`,
    },
  ];
}
