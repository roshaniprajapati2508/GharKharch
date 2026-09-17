// Stage 4-5 of the pipeline (spec section 47): "Structured result -> AI
// explanation." Every function here degrades to a deterministic, still-useful
// answer when OPENAI_API_KEY isn't set (spec section 46: "Do NOT make the
// entire application dependent on an LLM").

import { isAiConfigured, requestAiCompletion } from "@/lib/ai/openai-client";
import { buildFinancialQueryPrompt, buildInsightNarrationPrompt } from "@/lib/ai/prompt-builder";
import type { Insight } from "@/lib/expense-intelligence/spending-analyzer";

export interface AiAnswer {
  text: string;
  source: "ai" | "deterministic";
}

/**
 * Explains `structuredFacts` in response to `question`. `deterministicAnswer`
 * is a plain-language sentence built directly from the facts with no AI
 * involved - used verbatim when no API key is configured, and also as the
 * fallback if the AI call fails for any reason, so the assistant always
 * answers with something real.
 */
export async function explainFinancialAnswer(question: string, structuredFacts: unknown, deterministicAnswer: string): Promise<AiAnswer> {
  if (!isAiConfigured()) {
    return { text: deterministicAnswer, source: "deterministic" };
  }

  const aiText = await requestAiCompletion(buildFinancialQueryPrompt(question, structuredFacts));
  if (!aiText) {
    return { text: deterministicAnswer, source: "deterministic" };
  }
  return { text: aiText, source: "ai" };
}

/** Turns a list of already-generated Insights (spec section 30) into a short narrated summary, or joins them plainly when AI isn't configured. */
export async function narrateInsights(insights: Insight[]): Promise<AiAnswer> {
  const deterministic = insights.map((i) => i.text).join(" ");
  if (!isAiConfigured() || insights.length === 0) {
    return { text: deterministic, source: "deterministic" };
  }

  const aiText = await requestAiCompletion(buildInsightNarrationPrompt(insights));
  if (!aiText) return { text: deterministic, source: "deterministic" };
  return { text: aiText, source: "ai" };
}
