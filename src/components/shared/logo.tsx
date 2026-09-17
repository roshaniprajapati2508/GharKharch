import Image from "next/image";
import { cn } from "@/lib/utils";

/** Icon-only mark + coded wordmark. Use for headers, nav, and compact spaces. */
export function Logo({ className, iconSize = 28 }: { className?: string; iconSize?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={iconSize}
        height={iconSize}
        className="rounded-[8px]"
        priority
      />
      <span className="text-lg font-bold tracking-tight text-brand-primary">
        Ghar<span className="text-brand-green">Kharch</span>
      </span>
    </span>
  );
}

/** Full approved lockup (icon + wordmark + tagline) for auth screens and reports. */
export function FullLogo({ className, width = 220 }: { className?: string; width?: number }) {
  const height = Math.round((width * 930) / 1119);
  return (
    <Image
      src="/brand/logo-full.png"
      alt="GharKharch — Household Money, Clearly."
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
