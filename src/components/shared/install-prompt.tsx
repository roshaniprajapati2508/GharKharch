"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "gharkharch:install-prompt-dismissed";

/** Supports the browser's native install prompt (spec section 74) with a small, dismissible banner rather than an intrusive popup. */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a per-device preference on mount
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      // localStorage can throw in a private/locked-down browsing context - the prompt just stays hidden
    }

    function handler(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredEvent || dismissed) return null;

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // best-effort only
    }
  }

  return (
    <div className="no-print fixed inset-x-4 bottom-24 z-40 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-80">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-primary">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Install GharKharch</p>
        <p className="text-xs text-muted-foreground">Add it to your home screen for quick access.</p>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <button type="button" onClick={dismiss} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
