"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, pageTransition } from "@/lib/motion";

/**
 * Page-level transition wrapper (spec item 17): fades/slides each route's
 * content in on navigation, keyed on pathname so `AnimatePresence` treats
 * every route change as an enter/exit pair. Kept layout-stable (no absolute
 * positioning) so it never causes scroll-jumps or double-rendered content.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} variants={pageTransition} initial="hidden" animate="visible" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
