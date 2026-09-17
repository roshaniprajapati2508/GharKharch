"use client";

// Branded loading/splash experience (spec sections 15-16): the official
// GharKharch lockup (public/brand/logo-full.png) with a simple fade + scale
// entrance, finishing well inside the spec's ~800-1200ms target. Used by
// route-level `loading.tsx` files (Next.js shows these automatically during
// a segment's own data fetching, so this never forces a splash on every
// navigation) and can be dropped in anywhere else a full-screen branded
// loading state makes sense (e.g. the very first paint before auth
// resolves). Previously this redrew the mark as a hand-animated SVG
// approximation of the logo; using the real asset directly keeps the splash
// pixel-faithful to the brand instead of an inexact reconstruction of it.

import Image from "next/image";
import { motion, useReducedMotion } from "@/lib/motion";

export function LoadingScreen() {
  const reduced = useReducedMotion();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background">
      <motion.div
        initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.45, ease: "easeOut" }}
      >
        <Image src="/brand/logo-full.png" alt="GharKharch" width={168} height={140} priority className="h-auto w-[168px]" />
      </motion.div>
    </div>
  );
}
