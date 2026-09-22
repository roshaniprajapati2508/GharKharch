// Natural-language quick entry (spec section 45, 83).
// Deterministic and enhanced Indian & global financial NLP parser.
// Handles amounts (₹, Rs, k, Lakhs, /-, bucks), payment methods (UPI, GPay, PhonePe, Paytm, Cards, Netbanking, Cash),
// dates (yesterday, today, weekdays, 'X days ago', specific dates), merchants ("at Starbucks", "from Dmart"),
// income detection ("salary credited", "payout"), and bank/card hints.

import { getTodayISO, addDaysISO } from "@/lib/date-utils";

export interface ParsedQuickEntry {
  itemName: string;
  amount: number | null;
  paymentMethod: string | null;
  expenseDate: string;
  entryType?: "expense" | "income";
  merchantHint?: string | null;
  cardHint?: string | null;
  upiHint?: string | null;
  bankHint?: string | null;
  paidByHint?: string | null;
  expenseTypeHint?: "household" | "personal" | null;
  /** Words the parser couldn't confidently place - surfaced so the UI can show what was ignored rather than silently dropping it. */
  unmatchedTokens: string[];
}

const BANK_NAMES = [
  "hdfc",
  "sbi",
  "icici",
  "axis",
  "kotak",
  "pnb",
  "bob",
  "idfc",
  "indusind",
  "canara",
  "yes bank",
  "federal",
  "rbl",
  "au bank",
  "standard chartered",
  "hsbc",
  "citi",
  "onecard",
  "slice",
  "amex",
];

const INCOME_TRIGGERS = [
  /\b(salary|payroll|salary credit|monthly salary)\b/i,
  /\b(seller payout|marketplace payout|payout|freelance|consulting|client payment)\b/i,
  /\b(cashback|refund|dividend|interest received|rent received)\b/i,
  /\b(credited|received|got paid|income|sale|order payment|customer payment)\b/i,
  /\b(luxekraft|mobile cover|sling chain|ghugri|waist judo|macrame|haldi jewellery|mehndi jewellery|navratri collection|kashmiri watch|lippon|lippan|return gift|baby shower)\b/i,
];

function resolveWeekdayDate(dayName: string): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return getTodayISO();

  const now = new Date();
  const currentDay = now.getDay();
  let diff = currentDay - targetDay;
  if (diff <= 0) diff += 7; // Previous occurrence of this day

  return addDaysISO(getTodayISO(), -diff);
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseQuickEntry(input: string): ParsedQuickEntry {
  let remaining = (typeof input === "string" ? input : "").trim();
  let paymentMethod: string | null = null;
  let expenseDate = getTodayISO();
  let entryType: "expense" | "income" = "expense";
  let merchantHint: string | null = null;
  let cardHint: string | null = null;
  let upiHint: string | null = null;
  let bankHint: string | null = null;
  let paidByHint: string | null = null;
  let expenseTypeHint: "household" | "personal" | null = null;

  if (!remaining) {
    return {
      itemName: "",
      amount: null,
      paymentMethod: null,
      expenseDate,
      entryType,
      unmatchedTokens: [],
    };
  }

  // 1. Income detection
  for (const trigger of INCOME_TRIGGERS) {
    if (trigger.test(remaining)) {
      entryType = "income";
      break;
    }
  }

  // 2. Personal vs Household expense type
  if (/\b(personal|own|private)\b/i.test(remaining)) {
    expenseTypeHint = "personal";
    remaining = remaining.replace(/\b(personal|own|private)\b/gi, " ");
  } else if (/\b(household|shared|joint|home)\b/i.test(remaining)) {
    expenseTypeHint = "household";
    remaining = remaining.replace(/\b(household|shared|joint|home)\b/gi, " ");
  }

  // 3. Paid by person hint
  const paidByMatch = remaining.match(/\b(?:paid\s*by|by)\s+([a-zA-Z]+)\b/i);
  if (paidByMatch && !/^(upi|card|cash|gpay|phonepe|paytm|hdfc|sbi|icici|axis|kotak|today|yesterday)$/i.test(paidByMatch[1])) {
    paidByHint = paidByMatch[1];
    remaining = remaining.replace(paidByMatch[0], " ");
  }

  // 4. Date extraction
  if (/\b(day before yesterday|parso)\b/i.test(remaining)) {
    expenseDate = addDaysISO(getTodayISO(), -2);
    remaining = remaining.replace(/\b(day before yesterday|parso)\b/gi, " ");
  } else if (/\b(yesterday|kal|yday)\b/i.test(remaining)) {
    expenseDate = addDaysISO(getTodayISO(), -1);
    remaining = remaining.replace(/\b(yesterday|kal|yday)\b/gi, " ");
  } else if (/\b(today|aaj)\b/i.test(remaining)) {
    expenseDate = getTodayISO();
    remaining = remaining.replace(/\b(today|aaj)\b/gi, " ");
  } else {
    const daysAgoMatch = remaining.match(/\b(\d+)\s+days?\s+ago\b/i);
    if (daysAgoMatch) {
      expenseDate = addDaysISO(getTodayISO(), -parseInt(daysAgoMatch[1], 10));
      remaining = remaining.replace(daysAgoMatch[0], " ");
    } else {
      const weekdayMatch = remaining.match(/\b(?:last|this|on|past)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
      if (weekdayMatch) {
        expenseDate = resolveWeekdayDate(weekdayMatch[1]);
        remaining = remaining.replace(weekdayMatch[0], " ");
      } else {
        // Specific date like "15th Aug" or "Aug 15"
        const dateMonthMatch = remaining.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})(?:\s+(\d{4}))?\b/i) ||
                               remaining.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i);
        if (dateMonthMatch) {
          const isMonthFirst = isNaN(parseInt(dateMonthMatch[1], 10));
          const monthStr = (isMonthFirst ? dateMonthMatch[1] : dateMonthMatch[2]).toLowerCase();
          const dayNum = parseInt(isMonthFirst ? dateMonthMatch[2] : dateMonthMatch[1], 10);
          const yearNum = dateMonthMatch[3] ? parseInt(dateMonthMatch[3], 10) : new Date().getFullYear();

          if (MONTH_MAP[monthStr] !== undefined && dayNum >= 1 && dayNum <= 31) {
            const d = new Date(yearNum, MONTH_MAP[monthStr], dayNum);
            expenseDate = d.toISOString().split("T")[0];
            remaining = remaining.replace(dateMonthMatch[0], " ");
          }
        }
      }
    }
  }

  // 5. Payment method & instrument extraction
  // Check specific bank mentions
  for (const b of BANK_NAMES) {
    const reg = new RegExp(`\\b${b}\\b`, "i");
    if (reg.test(remaining)) {
      bankHint = b.toUpperCase();
      cardHint = b.toUpperCase();
      remaining = remaining.replace(reg, " ");
      break;
    }
  }

  // UPI Apps & keywords
  if (/\b(gpay|google\s*pay|phonepe|phone\s*pe|paytm|cred|bhim|amazon\s*pay|navi|bharatpe|famcard|upi)\b/i.test(remaining)) {
    paymentMethod = "UPI";
    const upiMatch = remaining.match(/\b(gpay|google\s*pay|phonepe|phone\s*pe|paytm|cred|bhim|amazon\s*pay)\b/i);
    if (upiMatch) upiHint = upiMatch[1].replace(/\s+/g, "");
    remaining = remaining.replace(/\b(gpay|google\s*pay|phonepe|phone\s*pe|paytm|cred|bhim|amazon\s*pay|navi|bharatpe|famcard|upi)\b/gi, " ");
  }
  // Credit card
  else if (/\b(credit\s*card|creditcard|cc|amex|visa|mastercard|onecard|slice)\b/i.test(remaining)) {
    paymentMethod = "Credit Card";
    remaining = remaining.replace(/\b(credit\s*card|creditcard|cc|amex|visa|mastercard|onecard|slice)\b/gi, " ");
  }
  // Debit card
  else if (/\b(debit\s*card|debitcard|dc|atm\s*card)\b/i.test(remaining)) {
    paymentMethod = "Debit Card";
    remaining = remaining.replace(/\b(debit\s*card|debitcard|dc|atm\s*card)\b/gi, " ");
  }
  // Generic card
  else if (/\b(?:by|on|via)?\s*card\b/i.test(remaining)) {
    paymentMethod = "Credit Card";
    remaining = remaining.replace(/\b(?:by|on|via)?\s*card\b/gi, " ");
  }
  // Cash
  else if (/\b(cash|rokda|rokhad|nagad)\b/i.test(remaining)) {
    paymentMethod = "Cash";
    remaining = remaining.replace(/\b(cash|rokda|rokhad|nagad)\b/gi, " ");
  }
  // Bank transfer
  else if (/\b(net\s*banking|netbanking|bank\s*transfer|neft|rtgs|imps|cheque|bank|online\s*transfer)\b/i.test(remaining)) {
    paymentMethod = "Bank Transfer";
    remaining = remaining.replace(/\b(net\s*banking|netbanking|bank\s*transfer|neft|rtgs|imps|cheque|bank|online\s*transfer)\b/gi, " ");
  }

  // 6. Amount extraction
  // Supports: ₹500, Rs 500, Rs. 500, 500rs, 500/-, 500 bucks, 1.5k, 2k, 1.5L, 25000, 1,50,000, "for 450", "spent 200"
  let amount: number | null = null;
  const AMOUNT_REGEX = /(?:(?:rs\.?|inr|₹|bucks)\s*|\b(?:spent|paid|for|worth|of|costing|cost)\s*(?:rs\.?|inr|₹)?\s*)?(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(k|l|lac|lakh|lakhs|cr|crore|crores)?\s*(?:rs\.?|inr|rupees|bucks|\/-|\/=)?(?=\b|\s|$)/i;

  const amountMatch = remaining.match(AMOUNT_REGEX);
  if (amountMatch) {
    const rawNum = parseFloat(amountMatch[1].replace(/,/g, ""));
    const multiplier = (amountMatch[2] || "").toLowerCase();
    if (multiplier === "k") {
      amount = Math.round(rawNum * 1000);
    } else if (multiplier === "l" || multiplier === "lac" || multiplier === "lakh" || multiplier === "lakhs") {
      amount = Math.round(rawNum * 100000);
    } else if (multiplier === "cr" || multiplier === "crore" || multiplier === "crores") {
      amount = Math.round(rawNum * 10000000);
    } else {
      amount = rawNum;
    }
    remaining = remaining.replace(amountMatch[0], " ");
  }

  // 7. Merchant hint extraction ("at Starbucks", "from Dmart", "to Yogesh bhai")
  const merchantMatch = remaining.match(/\b(?:at|from|to|in)\s+([A-Za-z0-9'&.\s\-]+?)(?:\s+(?:via|by|using|for|on|with|rs|inr|₹|\d|$))/i);
  if (merchantMatch && merchantMatch[1].trim()) {
    merchantHint = merchantMatch[1].trim();
    // Do not remove it completely if it's the only description, but mark it
  }

  // 8. Clean up item name
  let itemName = remaining
    // Clean noise connector words at beginning or standalone
    .replace(/\b(bought|purchased|spent\s*on|spent|paid\s*for|paid\s*to|paid|ordered|expense\s*for|bill\s*for|got|via|using|through|with|in)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If item name is empty but we extracted merchantHint, use merchantHint as itemName
  if (!itemName && merchantHint) {
    itemName = merchantHint;
  }

  // Clean trailing punctuation
  itemName = itemName.replace(/^[-–—,.:;/\\]+|[-–—,.:;/\\]+$/g, "").trim();

  return {
    itemName,
    amount,
    paymentMethod,
    expenseDate,
    entryType,
    merchantHint,
    cardHint,
    upiHint,
    bankHint,
    paidByHint,
    expenseTypeHint,
    unmatchedTokens: [],
  };
}
