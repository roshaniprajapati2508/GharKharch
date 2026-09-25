"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import { BrandLoaderMark } from "./brand-loader-mark";
import { Button } from "@/components/ui/button";

export type SignInStep = "idle" | "secure-link" | "verifying" | "dashboard" | "complete";
export type SignOutStep = "idle" | "signing-out" | "clearing-session" | "redirect" | "complete";

export interface AuthTransitionProps {
  mode: "sign-in" | "sign-out";
  step: SignInStep | SignOutStep;
  error?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const SIGN_IN_STEPS = [
  { id: "secure-link", label: "Secure link" },
  { id: "verifying", label: "Verifying" },
  { id: "dashboard", label: "Dashboard" },
] as const;

const SIGN_OUT_STEPS = [
  { id: "signing-out", label: "Signing out" },
  { id: "clearing-session", label: "Clearing session" },
  { id: "redirect", label: "Complete" },
] as const;

export function AuthTransition({
  mode,
  step,
  error,
  onRetry,
  onDismiss,
}: AuthTransitionProps) {
  if (step === "idle" && !error) return null;

  const isSignIn = mode === "sign-in";
  const stepsList = isSignIn ? SIGN_IN_STEPS : SIGN_OUT_STEPS;

  const currentStepIndex = stepsList.findIndex((s) => s.id === step);
  const isFinalStep = step === "complete" || (isSignIn && step === "dashboard") || (!isSignIn && step === "redirect");

  // Dynamic titles & subtitles bound to real application states
  let title = isSignIn ? "Signing In" : "Signing Out";
  let subtitle = isSignIn
    ? "Connecting securely to GharKharch..."
    : "Closing active household session...";

  if (step === "secure-link") {
    title = "Signing In";
    subtitle = "Securing credentials & contacting authentication servers...";
  } else if (step === "verifying") {
    title = "Verifying Session";
    subtitle = "Confirming household membership and user permissions...";
  } else if (step === "dashboard" || (isSignIn && step === "complete")) {
    title = "Welcome Back";
    subtitle = "All verified! Loading your household dashboard...";
  } else if (step === "signing-out") {
    title = "Signing Out";
    subtitle = "Closing authenticated session with database...";
  } else if (step === "clearing-session") {
    title = "Clearing Session";
    subtitle = "Flushing secure local storage, offline queue & cached keys...";
  } else if (step === "redirect" || (!isSignIn && step === "complete")) {
    title = "Signed Out";
    subtitle = "Session safely invalidated. Redirecting to login...";
  }

  if (error) {
    title = isSignIn ? "Sign-in Failed" : "Sign-out Interrupted";
    subtitle = error;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center"
        >
          {/* Ambient brand glow */}
          <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-brand-primary/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 h-36 w-36 rounded-full bg-brand-green/10 blur-2xl pointer-events-none" />

          {/* Central Loader Mark with CRM Favicon */}
          <div className="mb-5 mt-1">
            {error ? (
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20 shadow-inner">
                <AlertCircle className="h-10 w-10 stroke-[2.2]" />
              </div>
            ) : (
              <BrandLoaderMark size={88} isSuccess={isFinalStep} />
            )}
          </div>

          {/* Title & Subtitle */}
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-1.5 min-h-[58px]"
          >
            <h3 className="text-lg font-bold text-foreground tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
              {subtitle}
            </p>
          </motion.div>

          {/* Real State-Driven 3-Step Indicator */}
          {!error && (
            <div className="mt-6 w-full pt-4 border-t border-border/60">
              <ol className="flex items-center justify-between text-[11px] font-medium text-muted-foreground w-full">
                {stepsList.map((s, index) => {
                  const isDone =
                    currentStepIndex > index ||
                    (isFinalStep && index === stepsList.length - 1);
                  const isCurrent = currentStepIndex === index && !isFinalStep;
                  const isUpcoming = currentStepIndex < index;

                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-1.5 flex-1 justify-center first:justify-start last:justify-end"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] transition-colors duration-300 ${
                          isDone
                            ? "bg-brand-primary text-white"
                            : isCurrent
                            ? "border-2 border-brand-green bg-brand-green/20 text-brand-primary font-bold animate-pulse"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={`transition-colors duration-200 whitespace-nowrap ${
                          isDone
                            ? "text-brand-primary font-semibold"
                            : isCurrent
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground/70"
                        }`}
                      >
                        {s.label}
                      </span>
                      {index < stepsList.length - 1 && (
                        <div
                          className={`h-px w-3 sm:w-4 mx-1 transition-colors duration-300 ${
                            isDone ? "bg-brand-primary" : "bg-border"
                          }`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* Progress bar at the bottom */}
              <div className="mt-4 relative h-1 w-full overflow-hidden rounded-full bg-brand-primary/10">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary via-brand-green to-brand-yellow"
                  initial={{ width: "20%" }}
                  animate={{
                    width: isFinalStep
                      ? "100%"
                      : currentStepIndex === 0
                      ? "35%"
                      : currentStepIndex === 1
                      ? "70%"
                      : "90%",
                  }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}

          {/* Error Actions */}
          {error && (
            <div className="mt-6 flex w-full gap-2">
              {onRetry && (
                <Button
                  onClick={onRetry}
                  className="flex-1 bg-brand-primary text-white hover:bg-brand-primary/90"
                  size="sm"
                >
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="outline"
                  onClick={onDismiss}
                  className="flex-1"
                  size="sm"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
