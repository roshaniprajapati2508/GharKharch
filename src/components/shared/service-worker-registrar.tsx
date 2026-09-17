"use client";

import { useEffect } from "react";

/** Registers public/sw.js once, client-side only (spec section 74). Renders nothing. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration (e.g. unsupported browser, dev-mode HTTP) should
      // never break the app — GharKharch works fully without a service worker.
    });
  }, []);

  return null;
}
