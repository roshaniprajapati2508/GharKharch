"use client";

// "Ask GharKharch A.I" UI - Modern conversational household financial intelligence
// Features:
// - Seamless viewport & scrolling (never cuts off header or scrolls window on mount)
// - Dynamic typewriter streaming animation with glowing cursor
// - Multi-stage animated thinking / calculation indicator
// - Interactive Web Audio sound effects (send pop, answer chime, prompt tap, mute toggle)
// - Currency & metric visual highlighting
// - Smart contextual follow-up prompt chips
// - Modern glassmorphism UI with gradient glows

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  Trash2,
  Copy,
  Check,
  TrendingUp,
  PieChart,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Bot,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { askGharKharch } from "@/lib/actions/ai-assistant";
import { soundFx } from "@/lib/sound-effects";
import { useHousehold } from "@/lib/context/household-context";
import { UserAvatar } from "@/components/shared/user-avatar";

interface ConversationTurn {
  id: string;
  question: string;
  answerText: string | null;
  source: "ai" | "deterministic" | null;
  error: string | null;
  timestamp: string;
  isStreaming?: boolean;
}

const CATEGORIZED_SUGGESTIONS = [
  {
    category: "Homemade Business (LuxeKraft)",
    icon: ShoppingBag,
    color: "from-indigo-500/15 to-purple-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
    questions: [
      "What are our LuxeKraft sales this month?",
      "How much did we make on Mobile Covers?",
      "What's our business profit this month?",
      "How much did we make from Navratri Collection?",
      "How much revenue from Lippon Art & Jewellery?",
    ],
  },
  {
    category: "Incomes & Cashflow",
    icon: TrendingUp,
    color: "from-emerald-500/15 to-teal-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    questions: [
      "What are our total earnings this month?",
      "How much did I spend this month?",
      "How much did Harsh spend vs Roshni?",
    ],
  },
  {
    category: "Household & Categories",
    icon: PieChart,
    color: "from-amber-500/15 to-orange-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
    questions: [
      "What's my top category this month?",
      "How much on groceries last month?",
      "How much spent on Swiggy & Zomato?",
    ],
  },
];

const THINKING_STEPS = [
  "Analyzing your household transactions…",
  "Aggregating category breakdowns…",
  "Formatting financial insights…",
];

// Formats text to highlight INR amounts (₹X,XXX) and bold emphasis
function FormattedMessageContent({ text }: { text: string }) {
  const formattedElements = useMemo(() => {
    // Regular expression to match currency amounts like ₹45,000 or ₹1,250.50
    const parts = text.split(/(₹[\d,]+(?:\.\d{2})?)/g);
    return parts.map((part, index) => {
      if (/^₹[\d,]+(?:\.\d{2})?$/.test(part)) {
        return (
          <span
            key={index}
            className="inline-flex items-center font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [text]);

  return <p className="leading-relaxed text-sm text-foreground">{formattedElements}</p>;
}

// Typewriter streaming component for AI text
function TypewriterText({
  fullText,
  isStreaming,
  onComplete,
}: {
  fullText: string;
  isStreaming: boolean;
  onComplete?: () => void;
}) {
  const [displayedLength, setDisplayedLength] = useState(isStreaming ? 0 : fullText.length);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(fullText.length);
      return;
    }

    setDisplayedLength(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 2; // speed of streaming
      if (current >= fullText.length) {
        setDisplayedLength(fullText.length);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayedLength(current);
        if (current % 12 === 0) {
          soundFx.playTick();
        }
      }
    }, 18);

    return () => clearInterval(interval);
  }, [fullText, isStreaming, onComplete]);

  const displayedText = fullText.slice(0, displayedLength);
  const isTyping = isStreaming && displayedLength < fullText.length;

  return (
    <div className="relative">
      <FormattedMessageContent text={displayedText} />
      {isTyping && (
        <span className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-500 animate-pulse rounded-sm" />
      )}
    </div>
  );
}

function createTurnId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "turn-" + Date.now();
}

function getCurrentTimeStr(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AskGharKharchPage() {
  const { displayName, avatarUrl } = useHousehold();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [thinkingStepIdx, setThinkingStepIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync mute state on mount
  useEffect(() => {
    setIsMuted(soundFx.muted);
  }, []);

  // Cycle thinking step message smoothly
  useEffect(() => {
    if (!asking) return;
    setThinkingStepIdx(0);
    const interval = setInterval(() => {
      setThinkingStepIdx((prev) => (prev + 1) % THINKING_STEPS.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [asking]);

  // Smoothly scroll message container to bottom ONLY when messages exist
  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (turns.length > 0 || asking) {
      // Small timeout to allow DOM node render before scrolling
      const timer = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timer);
    }
  }, [turns.length, asking, scrollToBottom]);

  function toggleSound() {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
    toast.info(nextMuted ? "Sound effects muted" : "Sound effects enabled", {
      duration: 1800,
    });
  }

  function clearHistory() {
    setTurns([]);
    soundFx.playTap();
    toast.success("Chat history cleared");
  }

  async function handleCopy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundFx.playTap();
    toast.success("Answer copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function ask(text: string, isFromChip = false) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;

    if (isFromChip) {
      soundFx.playTap();
    } else {
      soundFx.playSend();
    }

    const turnId = createTurnId();
    const timeStr = getCurrentTimeStr();

    setAsking(true);
    setQuestion("");
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        question: trimmed,
        answerText: null,
        source: null,
        error: null,
        timestamp: timeStr,
        isStreaming: false,
      },
    ]);

    try {
      const result = await askGharKharch(trimmed);

      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.id === turnId) {
          if (result.data) {
            last.answerText = result.data.answer.text;
            last.source = result.data.answer.source;
            last.isStreaming = true;
          } else {
            last.error = result.error ?? "Could not retrieve financial data. Please try again.";
          }
        }
        return next;
      });

      if (result.data) {
        soundFx.playReceive();
      }
    } catch {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.id === turnId) {
          last.error = "Connection error. Please check your network and try again.";
        }
        return next;
      });
    } finally {
      setAsking(false);
    }
  }

  // Generate contextual follow-ups based on the last conversation turn
  const contextualFollowups = useMemo(() => {
    if (turns.length === 0) return [];
    const last = turns[turns.length - 1];
    const q = last.question.toLowerCase();

    if (q.includes("spend") || q.includes("total")) {
      return [
        "What's my top category this month?",
        "How much did I spend last month?",
        "Which category increased the most?",
      ];
    }
    if (q.includes("category")) {
      return [
        "Who is our top merchant this month?",
        "How much did I spend this month?",
        "How much on groceries last month?",
      ];
    }
    return [
      "How much did I spend this month?",
      "What's my top category this month?",
      "Which category increased the most?",
    ];
  }, [turns]);

  return (
    <div className="flex h-[calc(100dvh-120px)] sm:h-[calc(100dvh-140px)] max-h-[860px] flex-col overflow-hidden">
      {/* Sleek Top Header (Never cuts off) */}
      <header className="shrink-0 flex items-center justify-between pb-3.5 border-b border-border/60 bg-background/95">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/more"
            prefetch={true}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Back to More"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/20">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold tracking-tight text-foreground truncate">
                  Ask GharKharch A.I
                </h1>
                <Badge
                  variant="secondary"
                  className="hidden xs:inline-flex bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 font-medium"
                >
                  Live Data
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Household Financial Assistant
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            className="h-8.5 w-8.5 rounded-full text-muted-foreground hover:text-foreground"
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? <VolumeX className="h-4.5 w-4.5 text-muted-foreground/60" /> : <Volume2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />}
          </Button>
          {turns.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearHistory}
              className="h-8.5 w-8.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages / Welcome Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0 space-y-4 py-4 pr-1 scroll-smooth"
      >
        {/* Welcome State when no conversation has started */}
        {turns.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5 py-2"
          >
            {/* AI Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 via-background to-background p-5 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    Ask anything about your household finances
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Powered by your real household database. Get instant calculations on spending, category spikes, merchant totals, and monthly trends.
                  </p>
                </div>
              </div>
            </div>

            {/* Prompt Categories */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Suggested questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CATEGORIZED_SUGGESTIONS.map((cat, idx) => {
                  const Icon = cat.icon;
                  return (
                    <div
                      key={idx}
                      className="flex flex-col rounded-xl border border-border bg-card/60 p-3 shadow-2xs hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-foreground">
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br border", cat.color)}>
                          <Icon className="h-3 w-3" />
                        </span>
                        {cat.category}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {cat.questions.map((q) => (
                          <button
                            key={q}
                            onClick={() => ask(q, true)}
                            className="group flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all cursor-pointer"
                          >
                            <span className="truncate pr-1">{q}</span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Conversation Turns */}
        <AnimatePresence initial={false}>
          {turns.map((turn, i) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3"
            >
              {/* User Question */}
              <div className="flex items-end justify-end gap-2 ml-auto max-w-[88%] sm:max-w-[80%]">
                <div className="flex flex-col items-end gap-1">
                  <div className="rounded-2xl rounded-tr-xs bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm text-white shadow-sm shadow-emerald-600/10">
                    <p className="leading-relaxed font-medium">{turn.question}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 pr-1">{turn.timestamp}</span>
                </div>
                <div className="shrink-0 mb-4">
                  <UserAvatar name={displayName} avatarUrl={avatarUrl} className="h-6 w-6 ring-1 ring-border" />
                </div>
              </div>

              {/* Error Bubble */}
              {turn.error && (
                <div className="mr-auto max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tl-xs border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                  <RotateCcw className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Unable to process</p>
                    <p>{turn.error}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive"
                      onClick={() => ask(turn.question)}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* AI Answer Bubble */}
              {turn.answerText !== null && (
                <div className="mr-auto max-w-[92%] sm:max-w-[82%] flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xs mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="rounded-2xl rounded-tl-xs border border-border/80 bg-card p-4 shadow-2xs">
                      {/* Header in Bubble */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          <span>GharKharch A.I</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Verified Aggregation</span>
                        </div>
                      </div>

                      {/* Content with Typewriter / Formatting */}
                      <TypewriterText
                        fullText={turn.answerText}
                        isStreaming={turn.isStreaming ?? false}
                        onComplete={() => {
                          setTurns((prev) => {
                            const next = [...prev];
                            if (next[i]) next[i].isStreaming = false;
                            return next;
                          });
                        }}
                      />

                      {/* Footer Actions */}
                      <div className="mt-3.5 pt-2 flex items-center justify-between border-t border-border/40 text-[11px] text-muted-foreground">
                        <span className="text-[10px] text-muted-foreground/80">
                          {turn.source === "deterministic" ? "Exact SQL calculation" : "AI summarized"}
                        </span>
                        <button
                          onClick={() => handleCopy(turn.id, turn.answerText ?? "")}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          title="Copy answer"
                        >
                          {copiedId === turn.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Follow-up suggestions on the latest answer */}
                    {i === turns.length - 1 && !turn.isStreaming && !asking && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-1.5 pt-1 pl-1"
                      >
                        <span className="text-[11px] text-muted-foreground font-medium self-center pr-1">
                          Follow up:
                        </span>
                        {contextualFollowups.map((fq) => (
                          <button
                            key={fq}
                            onClick={() => ask(fq, true)}
                            className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-left text-xs font-medium text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all cursor-pointer"
                          >
                            {fq}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading / Thinking State */}
        {asking && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mr-auto max-w-[85%] flex items-start gap-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xs animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-xs border border-border/80 bg-card px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground font-medium animate-fade">
                {THINKING_STEPS[thinkingStepIdx]}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modern Bottom Input Bar */}
      <div className="shrink-0 pt-2 pb-1 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="relative flex items-center rounded-2xl border border-border bg-surface p-1.5 shadow-xs focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all"
        >
          <div className="pl-3 pr-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>

          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about spending, categories, merchants…"
            className="h-9 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70"
            disabled={asking}
          />

          <Button
            type="submit"
            size="icon"
            className={cn(
              "h-8.5 w-8.5 shrink-0 rounded-xl transition-all",
              question.trim()
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/30 hover:opacity-95 active:scale-95"
                : "bg-muted text-muted-foreground hover:bg-muted"
            )}
            disabled={asking || !question.trim()}
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
