"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BrandLoaderMark } from "./brand-loader-mark";

export interface OperationLoaderProps {
  open: boolean;
  title: string;
  subtitle?: string;
  isSuccess?: boolean;
  successMessage?: string;
  className?: string;
}

/**
 * OperationLoader:
 * Luxury modal loading overlay for CRM operations (saving, updating, deleting, syncing, exporting).
 * Features the CRM favicon in the centre with the brand-gradient rotating ring.
 */
export function OperationLoader({
  open,
  title,
  subtitle = "Please keep this tab open",
  isSuccess = false,
  successMessage,
  className = "",
}: OperationLoaderProps) {
  if (!open) return null;

  const displayTitle = isSuccess && successMessage ? successMessage : title;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={`relative w-full max-w-[310px] overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center ${className}`}
        >
          {/* Subtle brand ambient glow */}
          <div className="absolute -top-12 -left-12 h-28 w-28 rounded-full bg-brand-primary/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 h-28 w-28 rounded-full bg-brand-green/10 blur-xl pointer-events-none" />

          {/* CRM Favicon Loader Mark */}
          <div className="mb-4">
            <BrandLoaderMark size={76} isSuccess={isSuccess} />
          </div>

          {/* Title & Subtitle */}
          <motion.div
            key={displayTitle}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-1"
          >
            <h4 className="text-sm font-bold text-foreground tracking-tight">
              {displayTitle}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
                {subtitle}
              </p>
            )}
          </motion.div>

          {/* Subtle progress bar at bottom */}
          <div className="mt-4 relative h-1 w-full overflow-hidden rounded-full bg-brand-primary/10">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary via-brand-green to-brand-yellow"
              initial={{ width: "30%" }}
              animate={{ width: isSuccess ? "100%" : "85%" }}
              transition={{ duration: isSuccess ? 0.3 : 1.5, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
