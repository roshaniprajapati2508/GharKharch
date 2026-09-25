"use client";

import { AppLoader } from "./app-loader";

/**
 * LoadingScreen:
 * Branded loading screen featuring the official CRM favicon inside
 * the animated progress ring, consistent with all CRM loading states.
 */
export function LoadingScreen({
  title = "Loading GharKharch...",
  subtitle = "Household Money, Clearly.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return <AppLoader title={title} subtitle={subtitle} fullScreen={true} />;
}
