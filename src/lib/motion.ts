// Reusable motion primitives (spec section 8: "Global Motion System"). Every
// timing value below matches the spec's recommended durations exactly, so
// any component reaching for `MOTION.card` etc. stays consistent with the
// rest of the app instead of picking its own number. All entrance variants
// use `ease-out`-equivalent easing per spec section 8's guidance for
// entrances, and everything here respects `prefers-reduced-motion` through
// framer-motion's own `useReducedMotion` (re-exported below) - a component
// should collapse its `initial`/`animate` to the same state when that hook
// returns true rather than skipping animation setup awkwardly.

import type { Variants, Transition } from "framer-motion";

export const MOTION = {
  micro: 0.15, // 150ms - micro interactions (120-180ms)
  button: 0.18, // 150-200ms
  card: 0.22, // 180-250ms
  sheet: 0.3, // 250-350ms
  page: 0.25, // 200-300ms
} as const;

const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1]; // expo-out - snappy entrance, no overshoot

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: MOTION.card, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: MOTION.card, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: MOTION.card, ease: EASE_OUT } },
};

/** Parent wrapper: staggers its direct children's own `fadeInUp`/`scaleIn` variants. Use with `initial="hidden" animate="visible"` on the parent and children. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

/** Bottom sheet / drawer entrance (spec section 8: 250-350ms). */
export const sheetSlideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: MOTION.sheet, ease: EASE_OUT } },
  exit: { opacity: 0, y: 16, transition: { duration: MOTION.micro } },
};

/** Page-level transition wrapper (spec section 17): fade + slight vertical movement, layout-stable. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: MOTION.page, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: MOTION.micro } },
};

/** Success checkmark pop, used by the toast helpers and inline success states (spec section 11). */
export const successPop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 500, damping: 24 } },
};

/** List item insertion/removal (spec section 11-12: new expense insertion, delete slide-out). */
export const listItem: Variants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: { opacity: 1, height: "auto", marginBottom: 8, transition: { duration: MOTION.card, ease: EASE_OUT } },
  exit: { opacity: 0, x: -24, transition: { duration: MOTION.micro } },
};

export { useReducedMotion, AnimatePresence, motion } from "framer-motion";
