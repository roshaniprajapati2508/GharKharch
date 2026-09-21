"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Store, Receipt, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ExpenseList } from "@/components/expenses/expense-list";
import { AddExpenseSheet } from "@/components/shared/add-expense-sheet";
import { Sparkline } from "@/components/analytics/merchant-analytics-tab";
import { getMerchantProfile, type MerchantProfile } from "@/lib/actions/merchants";
import { softDeleteExpense, restoreExpense, duplicateExpense, type EnrichedExpense } from "@/lib/actions/expenses";
import { formatINR } from "@/lib/utils";
import { toastUndo } from "@/lib/toast-helpers";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Merchant/Vendor 360deg profile (spec: Pillar 3) - a dedicated page per
 * merchant with its spend metrics, a 6-month spend trend, and its full
 * transaction ledger (edit/duplicate/delete all work exactly as they do on
 * the main Expenses screen, since this reuses the same ExpenseList).
 */
export default function MerchantProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const merchantId = params.id;

  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EnrichedExpense | null>(null);

  async function load() {
    setLoading(true);
    const result = await getMerchantProfile(merchantId);
    setLoading(false);
    if (result.error !== null) {
      toast.error(result.error);
      router.replace("/more/merchants");
      return;
    }
    setProfile(result.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function handleDelete(expense: EnrichedExpense) {
    if (!profile) return;
    setProfile((p) => (p ? { ...p, transactions: p.transactions.filter((e) => e.id !== expense.id) } : p));
    const result = await softDeleteExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      load();
      return;
    }
    toastUndo(`${formatINR(expense.amount)} expense deleted`, async () => {
      const restored = await restoreExpense(expense.id);
      if (!restored.error) load();
    });
  }

  async function handleDuplicate(expense: EnrichedExpense) {
    const result = await duplicateExpense(expense.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Duplicated · ${formatINR(expense.amount)}`);
    load();
  }

  if (loading || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const trendValues = profile.monthlyTrend.map((t) => parseFloat(t.total));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more/merchants" prefetch={true} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Store className="h-4.5 w-4.5 text-muted-foreground" />
        </span>
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{profile.merchant.name}</h1>
      </div>

      {profile.truncated && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Showing stats for the most recent {profile.transactions.length} transactions with this merchant - it has more history than that.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4">
          <p className="text-[10px] font-medium text-muted-foreground">Total Spend</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatINR(profile.totalSpend)}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4">
          <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Receipt className="h-3 w-3" /> Transactions
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{profile.txnCount}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4">
          <p className="text-[10px] font-medium text-muted-foreground">Avg Transaction</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatINR(profile.avgTransaction)}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4">
          <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Calendar className="h-3 w-3" /> Last Purchase
          </p>
          <p className="mt-1 text-sm font-bold text-foreground">{formatDate(profile.lastPurchaseDate)}</p>
        </div>
      </div>

      {trendValues.some((v) => v > 0) && (
        <div className="rounded-2xl border border-border/50 bg-card/90 shadow-xs backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> 6-Month Spend Trend
            </p>
            <Sparkline values={trendValues} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">First purchase logged: {formatDate(profile.firstPurchaseDate)}</p>
        </div>
      )}

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Transaction History</h2>
        <ExpenseList expenses={profile.transactions} onEdit={setEditTarget} onDuplicate={handleDuplicate} onDelete={handleDelete} />
      </div>

      <AddExpenseSheet
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        editExpense={editTarget}
        onSaved={() => load()}
      />
    </div>
  );
}
