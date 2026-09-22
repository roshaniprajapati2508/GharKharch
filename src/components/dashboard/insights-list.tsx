import { Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateInsights, type InsightsInput } from "@/lib/expense-intelligence/spending-analyzer";

const TONE_STYLES = {
  positive: { bg: "bg-brand-mint", icon: "text-brand-primary", Icon: TrendingUp },
  neutral: { bg: "bg-muted", icon: "text-muted-foreground", Icon: Lightbulb },
  attention: { bg: "bg-brand-cream", icon: "text-brand-orange", Icon: AlertTriangle },
} as const;

/** Insights Engine output, rendered as small cards (spec section 30, styling guide section 24). */
export function InsightsList({ data }: { data: InsightsInput }) {
  const insights = generateInsights(data);
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">ઘરના ખર્ચ પર નજર (Insights)</h3>
      <div className="mt-3 flex flex-col gap-2">
        {insights.map((insight) => {
          const style = TONE_STYLES[insight.tone];
          const Icon = style.Icon;
          return (
            <div key={insight.id} className={cn("flex items-start gap-2.5 rounded-lg p-2.5", style.bg)}>
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} />
              <p className="text-sm text-foreground">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
