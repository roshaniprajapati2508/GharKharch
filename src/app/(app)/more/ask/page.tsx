"use client";

// "Ask GharKharch" UI (spec sections 46-47) — the user-facing surface for the
// User question -> Intent detection -> DB aggregation -> AI explanation
// pipeline in lib/actions/ai-assistant.ts. Every answer is derived from real,
// already-computed household numbers (shown in the "Based on" line below the
// answer) — the AI, when configured, only rephrases them.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askGharKharch } from "@/lib/actions/ai-assistant";

interface ConversationTurn {
  question: string;
  answerText: string | null;
  source: "ai" | "deterministic" | null;
  error: string | null;
}

const SUGGESTED_QUESTIONS = ["How much did I spend this month?", "What's my top category this month?", "How much on groceries last month?"];

export default function AskGharKharchPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setQuestion("");
    setTurns((prev) => [...prev, { question: trimmed, answerText: null, source: null, error: null }]);

    const result = await askGharKharch(trimmed);

    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (result.data) {
        last.answerText = result.data.answer.text;
        last.source = result.data.answer.source;
      } else {
        last.error = result.error ?? "Something went wrong";
      }
      return next;
    });
    setAsking(false);
  }

  return (
    <div className="flex h-[calc(100vh-var(--bottom-nav-h,0px))] flex-col pb-6">
      <div className="flex items-center gap-3 pb-4">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-foreground">
            <Sparkles className="h-4.5 w-4.5 text-brand-primary" />
            Ask GharKharch
          </h1>
          <p className="text-xs text-muted-foreground">Ask about your household spending, in plain words.</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="w-fit rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-foreground hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-primary px-4 py-2.5 text-sm text-white">{turn.question}</div>

            {turn.error && (
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {turn.error}
              </div>
            )}

            {turn.answerText === null && !turn.error && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary [animation-delay:300ms]" />
              </div>
            )}

            {turn.answerText !== null && (
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-2.5 text-sm text-foreground">
                {turn.answerText}
                {turn.source === "deterministic" && <p className="mt-1.5 text-[11px] text-muted-foreground">Calculated directly from your data.</p>}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className={cn("mt-3 flex items-center gap-2 rounded-full border border-border bg-surface p-1.5 pl-4")}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your spending…"
          className="h-9 border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          disabled={asking}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={asking || !question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
