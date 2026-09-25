"use client";

import { BrandLoaderMark } from "./brand-loader-mark";

export interface AppLoaderProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * Reusable AppLoader component.
 * Uses the official CRM favicon inside the brand progress ring,
 * and maintains GharKharch brand colors and typography.
 */
export function AppLoader({
  title = "Loading GharKharch...",
  subtitle = "Household Money, Clearly.",
  fullScreen = true,
  className = "",
}: AppLoaderProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 text-center p-6 ${className}`}>
      <BrandLoaderMark size={84} />

      <div className="flex flex-col items-center gap-1 brand-loader-text">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground max-w-xs">
            {subtitle}
          </p>
        )}
      </div>

      {/* Thin brand-gradient loading bar */}
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-brand-primary/10">
        <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-brand-primary via-brand-green to-brand-yellow animate-[brand-bar-sweep_1.5s_infinite_ease-in-out]" />
      </div>
    </div>
  );

  if (!fullScreen) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      {content}
    </div>
  );
}
