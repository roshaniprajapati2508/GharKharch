import type { Metadata } from "next";

// `more/page.tsx` is a client component ("use client"), which can't export
// its own `metadata` - this thin server layout carries it instead, the
// standard Next.js App Router pattern for that case (spec section 24).
export const metadata: Metadata = {
  title: "More",
  robots: { index: false, follow: false },
};

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
