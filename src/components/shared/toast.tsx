"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Check, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { BrandLoaderMark } from "./brand-loader-mark";

export type ToastTone = "success" | "error" | "warning" | "info" | "loading";

export interface ToastProps {
  id?: string | number;
  message: string;
  description?: string;
  tone?: ToastTone;
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

/**
 * Toast:
 * Luxury floating notification matching the reference CRM UI.
 * Features dark frosted glass with GharKharch emerald/teal aura,
 * a branded icon badge, optional action, and a bottom progress bar.
 */
export function Toast({
  message,
  description,
  tone = "success",
  duration = 3500,
  action,
  onDismiss,
}: ToastProps) {
  const [progressWidth, setProgressWidth] = useState(100);

  useEffect(() => {
    if (tone === "loading" || duration <= 0) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgressWidth(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [duration, tone]);

  // Tone specific styling & icons
  const iconConfig = {
    success: {
      boxBg: "bg-brand-primary/30 border-brand-green/40 text-brand-green",
      icon: <Sparkles className="h-4 w-4 stroke-[2.3]" />,
    },
    error: {
      boxBg: "bg-destructive/20 border-destructive/40 text-rose-300",
      icon: <AlertCircle className="h-4 w-4 stroke-[2.3]" />,
    },
    warning: {
      boxBg: "bg-amber-500/20 border-amber-400/40 text-amber-300",
      icon: <AlertTriangle className="h-4 w-4 stroke-[2.3]" />,
    },
    info: {
      boxBg: "bg-brand-primary/20 border-brand-primary/40 text-brand-mint",
      icon: <Info className="h-4 w-4 stroke-[2.3]" />,
    },
    loading: {
      boxBg: "bg-transparent border-none",
      icon: <BrandLoaderMark size={28} />,
    },
  }[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="group relative flex w-auto min-w-[280px] max-w-sm sm:max-w-md items-center gap-3 overflow-hidden rounded-2xl border border-brand-primary/25 bg-[#0a1513]/95 px-3.5 py-3 text-white shadow-[0_12px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-200"
    >
      {/* Icon Badge */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${iconConfig.boxBg} shadow-inner`}
      >
        {iconConfig.icon}
      </div>

      {/* Message & Subtitle */}
      <div className="flex flex-1 flex-col justify-center min-w-0 pr-1">
        <p className="text-xs font-semibold tracking-tight text-white leading-snug">
          {message}
        </p>
        {description && (
          <p className="text-[11px] text-zinc-300/80 leading-tight mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* Optional Action Button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 active:scale-95"
        >
          {action.label}
        </button>
      )}

      {/* Dismiss Button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-white transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Animated Bottom Brand Accent / Progress Bar */}
      {tone !== "loading" && duration > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-brand-primary/20">
          <div
            className="h-full bg-gradient-to-r from-brand-primary via-brand-green to-brand-yellow transition-all duration-75 ease-linear"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      )}
    </div>
  );
}
