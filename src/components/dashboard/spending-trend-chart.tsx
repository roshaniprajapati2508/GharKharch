"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn, formatINR } from "@/lib/utils";
import { parseISODate, shortDayLabel } from "@/lib/date-utils";
import type { Database } from "@/types/database";

type DailySpendingRow = Database["public"]["Functions"]["get_daily_spending"]["Returns"][number];

type Granularity = "daily" | "weekly" | "monthly";

interface ChartPoint {
  key: string;
  label: string;
  total: number;
}

function isoWeekKey(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function aggregate(daily: DailySpendingRow[], granularity: Granularity): ChartPoint[] {
  if (granularity === "daily") {
    return daily.map((d) => ({ key: d.expense_date, label: shortDayLabel(d.expense_date), total: parseFloat(d.total) }));
  }

  const buckets = new Map<string, { total: number; firstDate: string }>();
  for (const d of daily) {
    const key = granularity === "weekly" ? isoWeekKey(d.expense_date) : d.expense_date.slice(0, 7);
    const bucket = buckets.get(key) ?? { total: 0, firstDate: d.expense_date };
    bucket.total += parseFloat(d.total);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => ({
    key,
    total: bucket.total,
    label:
      granularity === "weekly"
        ? `W${key.split("-W")[1]}`
        : parseISODate(`${key}-01`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  }));
}

/** Spending-trend chart with a Daily/Weekly/Monthly toggle (spec section 8A, 18, 19). */
export function SpendingTrendChart({ dailySpending }: { dailySpending: DailySpendingRow[] }) {
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const data = useMemo(() => aggregate(dailySpending, granularity), [dailySpending, granularity]);
  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Spending trend</h3>
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          {(["daily", "weekly", "monthly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                granularity === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="mt-3 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={granularity === "daily" && data.length > 15 ? Math.ceil(data.length / 8) : 0}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(value) => [formatINR(Number(value) || 0), "Spent"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  background: "var(--popover)",
                }}
              />
              <Bar dataKey="total" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} maxBarSize={granularity === "monthly" ? 32 : 14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-6 pb-4 text-center text-sm text-muted-foreground">No spending in this period yet.</p>
      )}
    </div>
  );
}
