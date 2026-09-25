"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { TopBar } from "@/components/shared/top-bar";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { ServiceWorkerRegistrar } from "@/components/shared/service-worker-registrar";
import { PageTransition } from "@/components/shared/page-transition";
import { AddExpenseProvider, useAddExpense } from "@/lib/context/add-expense-context";
import { SearchProvider } from "@/lib/context/search-context";
import { OfflineProvider } from "@/lib/context/offline-context";
import { FooterCredit } from "@/components/shared/footer";
import { initNavigationSystem } from "@/lib/navigation/navigation-controller";

const PAGE_ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  expenses: "/expenses",
  leads: "/expenses",
  deals: "/expenses",
  tasks: "/expenses",
  analytics: "/analytics",
  reports: "/reports",
  invoices: "/reports",
  categories: "/more/categories",
  merchants: "/more/merchants",
  budgets: "/more/budgets",
  recurring: "/more/recurring",
  rules: "/more/rules",
  scratchpad: "/more/scratchpad",
  duplicates: "/more/duplicates",
  "payment-methods": "/more/payment-methods",
  activity: "/more/activity",
  ask: "/more/ask",
  import: "/more/import",
  settings: "/more",
  changelog: "/more",
};

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { openAdd } = useAddExpense();
  const router = useRouter();

  useEffect(() => {
    const cleanup = initNavigationSystem({
      onNavigate: (page: string) => {
        const targetRoute = PAGE_ROUTE_MAP[page] || `/${page}`;
        router.push(targetRoute);
      },
    });
    return cleanup;
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="no-print contents">
        <OfflineBanner />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="no-print contents">
          <SidebarNav onAddClick={openAdd} />
        </div>

        <div className="main flex min-w-0 flex-1 flex-col">
          <div className="no-print contents">
            <TopBar />
          </div>
          {/* Bottom padding on mobile clears the docked liquid-glass bottom bar and FAB */}
          <main className="flex-1 min-w-0 max-w-full overflow-x-clip px-4 pt-4 pb-[calc(var(--mobile-dock-height)+env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:pb-8 sm:pt-6 print:px-0 print:pb-0 print:pt-0 flex flex-col">
            <div className="mx-auto w-full max-w-5xl min-w-0 flex-1 flex flex-col justify-between">
              <PageTransition>{children}</PageTransition>
              <div className="no-print mt-12 pb-2">
                <FooterCredit />
              </div>
            </div>
          </main>
        </div>

        <div className="no-print contents">
          <BottomNav onAddClick={openAdd} />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // `reducedMotion="user"` (spec item 87): every framer-motion `motion.*` component anywhere
    // under this shell automatically collapses its transitions to instant when the OS-level
    // prefers-reduced-motion setting is on - a single systematic fix instead of each component
    // having to remember to call `useReducedMotion()` itself.
    <MotionConfig reducedMotion="user">
      <OfflineProvider>
        <AddExpenseProvider>
          <SearchProvider>
            <ServiceWorkerRegistrar />
            <AppShellInner>{children}</AppShellInner>
            <InstallPrompt />
          </SearchProvider>
        </AddExpenseProvider>
      </OfflineProvider>
    </MotionConfig>
  );
}
