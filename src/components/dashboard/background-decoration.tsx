// Subtle dashboard background decoration (spec item 20): soft flowing lines
// and a leaf motif, low-opacity, absolutely positioned behind the content and
// never intercepting pointer events. Fixed to the viewport so it doesn't add
// scrollable height, and hidden in print output alongside the rest of the
// app chrome.
export function DashboardBackgroundDecoration() {
  return (
    <svg
      className="no-print pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] w-full opacity-[0.05]"
      viewBox="0 0 400 420"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M-20 80 C 80 20, 160 140, 260 60 S 420 20, 460 90"
        stroke="var(--brand-primary)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M-20 180 C 100 120, 180 240, 300 160 S 440 140, 470 210"
        stroke="var(--brand-green)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M320 40 C 340 20, 360 20, 372 40 C 360 55, 340 55, 320 40 Z"
        fill="var(--brand-green)"
      />
      <path
        d="M40 260 C 60 240, 80 240, 92 260 C 80 275, 60 275, 40 260 Z"
        fill="var(--brand-orange)"
      />
    </svg>
  );
}
