"use client";

import { usePathname } from "next/navigation";
import { motion, fadeIn } from "@/lib/motion";

/**
 * Page-level transition wrapper: light entrance fade without blocking navigation.
 * Uses key={pathname} to trigger entrance smoothly on route changes without
 * exit-blocking pauses.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="w-full min-w-0 max-w-full"
    >
      {children}
    </motion.div>
  );
}

