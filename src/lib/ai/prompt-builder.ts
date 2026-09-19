// Prompt construction for the AI explanation step (spec section 47's final
// pipeline stage: "Structured result -> AI explanation"). Every prompt here
// embeds the already-computed facts and explicitly forbids the model from
// adding numbers that weren't given to it.

import type { ChatMessage } from "@/lib/ai/openai-client";

const SYSTEM_PROMPT = `You are "Ask GharKharch A.I", the intelligent personal financial CFO for an Indian household and Homemade Business (LuxeKraft covers & Roshni's Mehndi Art).
Rules you must follow:
- Be clear, direct, and insightful. Always provide crisp answers using the exact numbers and financial context provided.
- Always format currency in Indian Rupees (₹X,XXX). Highlight positive inflows with (+) and expenses/costs with (-).
- For business queries, clearly explain Revenue, Expenses, Net Profit/Loss, and Profit Margin %.
- For household queries, explain spending trends, top categories, member contributions, and cashflow.
- If asked open-ended or advisory questions ("How are our finances?", "Where are we spending most?"), synthesize the real data provided into a clear 2-4 sentence summary with key takeaways.
- Never invent numbers that are not supported by the JSON context. If something has no data recorded, state it warmly.`;

export function buildFinancialQueryPrompt(question: string, structuredFacts: unknown): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `User Question: "${question}"\n\nReal Household Financial Snapshot (JSON):\n${JSON.stringify(structuredFacts, null, 2)}\n\nPlease provide a clear, helpful, and concise answer based on this real data.`,
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
