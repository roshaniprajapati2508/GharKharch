// Pure, non-server-action helper. Kept out of lib/actions/merchants.ts because
// a "use server" file may only export async Server Actions - Next.js 16
// enforces this at build time ("Server Actions must be async functions"), so
// a plain sync utility like this one has to live in its own module even
// though it's only ever used from that file.

/** Matches the normalization the 001 SQL trigger applies to merchants created via create_household(). */
export function normalizeMerchantName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
