"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, Users, Repeat, ChevronRight } from "lucide-react";
import { TopMerchantsCard } from "@/components/dashboard/top-merchants-card";
import { PersonComparisonCard } from "@/components/dashboard/person-comparison-card";
import { MostFrequentCard } from "@/components/dashboard/most-frequent-card";
import { useHousehold } from "@/lib/context/household-context";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type MerchantBreakdownRow = Database["public"]["Functions"]["get_merchant_breakdown"]["Returns"][number];
type PersonBreakdownRow = Database["public"]["Functions"]["get_person_breakdown"]["Returns"][number];
type ItemAnalyticsRow = Database["public"]["Functions"]["get_item_analytics"]["Returns"][number];

interface MerchantMemberCardProps {
  merchants: MerchantBreakdownRow[];
  personBreakdown: PersonBreakdownRow[];
  itemAnalytics: ItemAnalyticsRow[];
}

export function MerchantMemberCard({
  merchants,
  personBreakdown,
  itemAnalytics,
}: MerchantMemberCardProps) {
  const { partner } = useHousehold();
  const hasPartner = !!partner && personBreakdown.length > 0;
  const hasMerchants = merchants.length > 0;
  const hasFrequent = itemAnalytics.length > 0;

  const [activeTab, setActiveTab] = useState<"merchants" | "person" | "frequent">("merchants");

  if (!hasMerchants && !hasPartner && !hasFrequent) return null;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-border">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5">
          {hasMerchants && (
            <button
              type="button"
              onClick={() => setActiveTab("merchants")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "merchants"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Store className="h-3.5 w-3.5 text-brand-primary" />
              Merchants
            </button>
          )}

          {hasPartner && (
            <button
              type="button"
              onClick={() => setActiveTab("person")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "person"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              By Member
            </button>
          )}

          {hasFrequent && (
            <button
              type="button"
              onClick={() => setActiveTab("frequent")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "frequent"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Repeat className="h-3.5 w-3.5 text-amber-500" />
              Frequent
            </button>
          )}
        </div>

        {activeTab === "merchants" && (
          <Link href="/analytics" className="flex items-center text-xs font-medium text-primary hover:underline">
            See all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Tab Body */}
      <div className="pt-2">
        {activeTab === "merchants" && (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div>div:first-child]:hidden">
            <TopMerchantsCard merchants={merchants} limit={5} />
          </div>
        )}

        {activeTab === "person" && (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div>h3]:hidden">
            <PersonComparisonCard personBreakdown={personBreakdown} />
          </div>
        )}

        {activeTab === "frequent" && (
          <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div>h3]:hidden">
            <MostFrequentCard items={itemAnalytics} limit={5} />
          </div>
        )}
      </div>
    </div>
  );
}
