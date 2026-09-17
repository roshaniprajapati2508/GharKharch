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

export function getShortBankName(name?: string | null): string {
  if (!name) return "";
  const clean = name.trim();
  const map: Record<string, string> = {
    "HDFC Bank": "HDFC",
    "ICICI Bank": "ICICI",
    "State Bank of India": "SBI",
    "Axis Bank": "Axis",
    "Kotak Mahindra Bank": "Kotak",
    "IDFC FIRST Bank": "IDFC",
    "American Express": "Amex",
    "Bank of Baroda": "BOB",
    "Punjab National Bank": "PNB",
    "Federal Bank": "Federal",
    "IndusInd Bank": "IndusInd",
    "Standard Chartered": "StanC",
    "RBL Bank": "RBL",
    "Yes Bank": "Yes",
    "Scapia": "Scapia",
  };
  return map[clean] ?? clean.replace(/ Bank$/i, "");
}

export function formatCardLabel(card: { custom_name: string; issuer_name?: string | null; last4?: string | null }): string {
  const bank = getShortBankName(card.issuer_name);
  const name = card.custom_name.trim();
  const last4 = card.last4 ? ` •••• ${card.last4}` : "";

  if (bank) {
    if (name.toLowerCase().includes(`(${bank.toLowerCase()})`)) {
      return `${name}${last4}`;
    }
    return `${name} (${bank})${last4}`;
  }
  return `${name}${last4}`;
}

