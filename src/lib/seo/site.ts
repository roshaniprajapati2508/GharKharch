// Central SEO/brand configuration (spec: "SEO & Discoverability Layer" section
// 29). Every piece of public-facing metadata - canonical URLs, Open Graph,
// Twitter cards, structured data, the sitemap - reads from here instead of
// hard-coding strings per file, so the brand name/tagline/URL only ever need
// to change in one place.

/**
 * The production URL, from NEXT_PUBLIC_SITE_URL. Falls back to localhost for
 * local dev only - never hard-code a temporary localhost URL into anything
 * that reads from SITE_URL itself.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "GharKharch";
export const SITE_TAGLINE = "Household Money, Clearly.";
export const SITE_DESCRIPTION =
  "GharKharch is a private household expense tracker for two people. Track everyday spending, budgets, recurring expenses and spending insights from one simple app.";
export const SITE_LOCALE = "en_IN";

/** Absolute URL to the default Open Graph / Twitter card image (see app/opengraph-image.tsx). */
export const OG_IMAGE_PATH = "/opengraph-image";

export const BRAND = {
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  logoPath: "/brand/logo-full.png",
  colors: {
    primary: "#087f6e", // --brand-primary, deep teal/green
    green: "#22c55e",
    orange: "#f97316",
    cream: "#fff8eb",
  },
} as const;

/**
 * Public, indexable marketing pages - the only ones that belong in the
 * sitemap or that get robots:index. Every other route in the app is a
 * private, authenticated screen and stays noindex by the root layout's
 * default.
 *
 * "/" is deliberately NOT listed here: it has no public content of its own
 * today - it always redirects (to /login or /dashboard depending on auth
 * state) rather than rendering a page, so indexing it would just index a
 * redirect. Add it back once a real public marketing homepage exists at
 * that route. Same reasoning for /features and /about - they don't exist
 * yet, so they're deliberately left out rather than added as empty stubs.
 */
export const PUBLIC_PATHS = ["/privacy", "/terms"] as const;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
