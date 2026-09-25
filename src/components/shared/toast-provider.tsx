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
export function ToastProvider({ position = "bottom-center" }: ToastProviderProps) {
  return (
    <SonnerToaster
      position={position}
      // Safe-area aware on mobile: elevated above navigation bars and home indicator
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)",
      }}
      icons={{
        success: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-brand-green/40 bg-brand-primary/30 text-brand-green shadow-inner">
            <Sparkles className="h-3.5 w-3.5 stroke-[2.3]" />
          </div>
        ),
        error: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/20 text-rose-300 shadow-inner">
            <AlertCircle className="h-3.5 w-3.5 stroke-[2.3]" />
          </div>
        ),
        warning: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/20 text-amber-300 shadow-inner">
            <AlertTriangle className="h-3.5 w-3.5 stroke-[2.3]" />
          </div>
        ),
        info: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-brand-primary/40 bg-brand-primary/20 text-brand-mint shadow-inner">
            <Info className="h-3.5 w-3.5 stroke-[2.3]" />
          </div>
        ),
        loading: (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <BrandLoaderMark size={26} />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group relative flex w-auto min-w-[280px] max-w-sm sm:max-w-md items-center gap-3 overflow-hidden rounded-2xl border border-brand-primary/25 bg-[#0a1513]/95 px-3.5 py-3 text-white shadow-[0_12px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl",
          title: "text-xs font-semibold tracking-tight text-white leading-snug",
          description: "text-[11px] text-zinc-300/80 leading-tight mt-0.5",
          actionButton:
            "shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 active:scale-95",
          cancelButton:
            "shrink-0 rounded-md p-1 text-zinc-400 hover:text-white transition-colors",
          closeButton:
            "text-zinc-400 hover:text-white transition-colors",
        },
      }}
      gap={8}
      duration={3500}
    />
  );
}

export { ToastProvider as Toaster };
