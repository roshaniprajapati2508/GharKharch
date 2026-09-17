import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a number as Indian Rupees using the en-IN locale (e.g. ₹1,25,000). */
export function formatINR(amount: number | string, opts: { showDecimals?: boolean } = {}) {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: opts.showDecimals ? 2 : 0,
    maximumFractionDigits: opts.showDecimals ? 2 : 0,
  }).format(value);
}

/** Safe percentage change: never returns Infinity or NaN. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
