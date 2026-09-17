"use client";

import { MotionConfig } from "framer-motion";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { TopBar } from "@/components/shared/top-bar";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { ServiceWorkerRegistrar } from "@/components/shared/service-worker-registrar";
import { PageTransition } from "@/components/shared/page-transition";
import { AddExpenseProvider, useAddExpense } from "@/lib/context/add-expense-context";
import { OfflineProvider } from "@/lib/context/offline-context";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { openAdd } = useAddExpense();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="no-print contents">
        <OfflineBanner />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="no-print contents">
          <SidebarNav onAddClick={openAdd} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="no-print contents">
            <TopBar />
          </div>
          {/* Bottom padding on phones must clear the bottom nav bar *and* the
              floating Add button, which is raised half outside the bar
              (see bottom-nav.tsx) - 5rem covers both with a small buffer,
              plus the device's own safe-area inset on top of that. From
              `sm` up there's no bottom nav (SidebarNav takes over), so it
              drops back to ordinary page padding. */}
          <main className="flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-8 sm:pt-6 print:px-0 print:pb-0 print:pt-0">
            <div className="mx-auto w-full max-w-5xl">
              <PageTransition>{children}</PageTransition>
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
          <ServiceWorkerRegistrar />
          <AppShellInner>{children}</AppShellInner>
          <InstallPrompt />
        </AddExpenseProvider>
      </OfflineProvider>
    </MotionConfig>
  );
}
