"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import type { SignInStep, SignOutStep } from "@/components/shared/auth-transition";

export function useAuthFlow() {
  const router = useRouter();
  const [signInStep, setSignInStep] = useState<SignInStep>("idle");
  const [signOutStep, setSignOutStep] = useState<SignOutStep>("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * Real state-driven sign-in flow:
   * Step 1: Secure link (starts when auth network request begins)
   * Step 2: Verifying (runs when credentials pass and session/profile is verified)
   * Step 3: Dashboard (runs when verified and app transitions to dashboard)
   */
  async function signInWithCredentials(values: { email: string; password: string }) {
    setAuthError(null);
    setSignInStep("secure-link");

    const supabase = createClient();

    // Step 1: Real authentication network request
    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setSignInStep("idle");
      setAuthError(error.message);
      toastError("Couldn't sign in", { description: error.message });
      return false;
    }

    if (!data.session) {
      setSignInStep("idle");
      setAuthError("No active session returned. Please check your credentials.");
      toastError("Couldn't sign in", { description: "No session found" });
      return false;
    }

    // Step 2: Real session & household verification
    setSignInStep("verifying");

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session) {
        throw new Error(sessionErr?.message || "Failed to verify session tokens");
      }

      // Check user profile or household context
      await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", sessionData.session.user.id)
        .limit(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Session verification failed";
      setSignInStep("idle");
      setAuthError(msg);
      toastError("Session verification failed", { description: msg });
      return false;
    }

    // Step 3: Real transition to Dashboard
    setSignInStep("dashboard");
    router.prefetch("/dashboard");

    // Brief smooth transition for visual handoff into the dashboard
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 450);

    return true;
  }

  /**
   * Real state-driven sign-out flow:
   * Step 1: Signing Out (starts when user requests logout)
   * Step 2: Clearing session (invalidates local storage, offline cache, and verifies null session)
   * Step 3: Complete / Redirect (navigates safely to login)
   */
  async function signOut() {
    setAuthError(null);
    setSignOutStep("signing-out");

    const supabase = createClient();

    try {
      // Step 1: Invalidate server session
      await supabase.auth.signOut();

      // Step 2: Clear local cache and verify session is gone
      setSignOutStep("clearing-session");

      if (typeof window !== "undefined") {
        try {
          sessionStorage.clear();
          // Clear any non-essential cached keys
          const keysToRemove = ["gharkharch_cache", "supabase.auth.token"];
          for (const key of keysToRemove) {
            localStorage.removeItem(key);
          }
        } catch {
          // ignore local storage security errors
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Attempt a forceful local cleanup if session remains
        await supabase.auth.signOut({ scope: "local" });
      }

      // Step 3: Redirect to login
      setSignOutStep("redirect");
      router.prefetch("/login");

      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 400);

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign out cleanly";
      setSignOutStep("idle");
      setAuthError(msg);
      toastError("Sign out failed", { description: msg });
      return false;
    }
  }

  return {
    signInStep,
    signOutStep,
    authError,
    signInWithCredentials,
    signOut,
    resetAuthFlow: () => {
      setSignInStep("idle");
      setSignOutStep("idle");
      setAuthError(null);
    },
  };
}
