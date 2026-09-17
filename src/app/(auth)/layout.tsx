import { MotionConfig } from "framer-motion";
import { FullLogo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Same systematic prefers-reduced-motion handling as AppShell (spec item 87) — the auth
    // pages render outside AppShell, so they need their own MotionConfig boundary.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-mint to-brand-cream px-5 py-10">
        <div className="mb-8">
          <FullLogo width={180} />
        </div>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </MotionConfig>
  );
}
