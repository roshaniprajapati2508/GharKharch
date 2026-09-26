"use client";

import { Toaster as SonnerToaster } from "sonner";
import { Sparkles, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { BrandLoaderMark } from "./brand-loader-mark";

export interface ToastProviderProps {
  position?: "top-center" | "top-right" | "bottom-center" | "bottom-right";
}

/**
 * ToastProvider component:
 * Configures the global toast notification system with safe-area support,
 * luxury dark frosted glass styling, and GharKharch brand colors and icons.
 */
export function ToastProvider({ position = "top-center" }: ToastProviderProps) {
  return (
    <SonnerToaster
      position={position}
      // Positioned cleanly from top safe area away from bottom navigation, sheets, and keyboards
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
      }}
      icons={{
        success: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 stroke-[2.4]" />
          </div>
        ),
        error: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-sm">
            <AlertCircle className="h-3.5 w-3.5 stroke-[2.4]" />
          </div>
        ),
        warning: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5 stroke-[2.4]" />
          </div>
        ),
        info: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary dark:text-emerald-400 border border-brand-primary/25 shadow-sm">
            <Info className="h-3.5 w-3.5 stroke-[2.4]" />
          </div>
        ),
        loading: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <BrandLoaderMark size={24} />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group relative flex w-auto min-w-[280px] max-w-[92vw] sm:max-w-md items-center gap-3 overflow-hidden rounded-2xl border border-black/8 dark:border-white/10 bg-white/95 dark:bg-[#0e1c19]/95 px-4 py-3 text-foreground shadow-[0_12px_36px_rgba(8,127,110,0.12),0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl",
          title: "text-[13px] font-semibold tracking-tight text-foreground leading-snug",
          description: "text-xs text-muted-foreground leading-tight mt-0.5",
          actionButton:
            "shrink-0 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary/90 active:scale-95",
          cancelButton:
            "shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors",
          closeButton:
            "text-muted-foreground hover:text-foreground transition-colors",
        },
      }}
      gap={8}
      duration={3200}
    />
  );
}

export { ToastProvider as Toaster };
