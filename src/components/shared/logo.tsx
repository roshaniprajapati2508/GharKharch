import Image from "next/image";

/** Full approved lockup (icon + wordmark + tagline), the official logo asset - used everywhere the brand mark appears, from compact headers to auth screens and reports, instead of any hand-typed wordmark. */
export function FullLogo({ className, width = 220 }: { className?: string; width?: number }) {
  const height = Math.round((width * 767) / 1024);
  return (
    <Image
      src="/brand/logo-full.png"
      alt="GharKharch - Household Money, Clearly."
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
