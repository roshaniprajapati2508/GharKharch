// Asia/Kolkata-aware date helpers (spec section 38, 68).
// `expenses.expense_date` is a plain SQL `date` with no timezone attached, so
// the app must independently agree on what "today" means in India rather than
// trusting the browser's local timezone. We always compute an ISO
// (YYYY-MM-DD) calendar-date string in Asia/Kolkata and compare those strings
// directly — ISO date strings sort/compare correctly as plain strings.

const KOLKATA_TZ = "Asia/Kolkata";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KOLKATA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns a YYYY-MM-DD string for the given instant, as a calendar date in Asia/Kolkata. */
export function toKolkataISODate(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return isoFormatter.format(date);
}

/** Today's calendar date in Asia/Kolkata, as YYYY-MM-DD. */
export function getTodayISO(): string {
  return toKolkataISODate(new Date());
}

/** Normalizes any Date to the 1st of its month in YYYY-MM-01 format. */
export function toPeriodMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Parses a YYYY-MM-DD string into a UTC-midnight Date (safe for date-fns arithmetic on the calendar date only). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formats a YYYY-MM-DD string back to an ISO date string, offset by `days` (can be negative). */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DateRange {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  label: string;
}

export function getTodayRange(): DateRange {
  const today = getTodayISO();
  return { start: today, end: today, label: "Today" };
}

export function getWeekRange(startOfWeek: "monday" | "sunday" = "monday"): DateRange {
  const today = parseISODate(getTodayISO());
  const dow = today.getUTCDay(); // 0 = Sunday
  const diffToStart = startOfWeek === "monday" ? (dow === 0 ? 6 : dow - 1) : dow;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - diffToStart);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: "This week" };
}

export function getMonthRange(monthsAgo = 0): DateRange {
  const today = parseISODate(getTodayISO());
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() - monthsAgo;
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const label = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label };
}

export function getPreviousMonthRange(): DateRange {
  return { ...getMonthRange(1), label: "Last month" };
}

export function getLast30DaysRange(): DateRange {
  const end = getTodayISO();
  const start = addDaysISO(end, -29);
  return { start, end, label: "Last 30 days" };
}

export function getLast7DaysRange(): DateRange {
  const end = getTodayISO();
  const start = addDaysISO(end, -6);
  return { start, end, label: "Last 7 days" };
}

export function getYearRange(yearsAgo = 0): DateRange {
  const today = parseISODate(getTodayISO());
  const y = today.getUTCFullYear() - yearsAgo;
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: String(y),
  };
}

export function getCustomDateRange(start: string, end: string): DateRange {
  return { start, end, label: "Custom range" };
}

/** Number of calendar days spanned by an ISO range, inclusive of both ends. */
export function daysBetweenISO(start: string, end: string): number {
  const ms = parseISODate(end).getTime() - parseISODate(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The immediately-preceding period of the same length, used for "vs last
 * period" comparisons (spec section 7, 29). A month-shaped range (spec's
 * "This Month" filter) compares against the calendar month before it rather
 * than a same-length window, since "28 Aug - 27 Sep" reads oddly to a user
 * expecting "vs August".
 */
export function getPreviousComparableRange(range: DateRange): DateRange {
  const start = parseISODate(range.start);
  const nextMonthFirst = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const isFullCalendarMonth = start.getUTCDate() === 1 && addDaysISO(range.end, 1) === nextMonthFirst;

  if (isFullCalendarMonth) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() - 1;
    const prevStart = new Date(Date.UTC(y, m, 1));
    const prevEnd = new Date(Date.UTC(y, m + 1, 0));
    return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10), label: "Previous month" };
  }

  const days = daysBetweenISO(range.start, range.end);
  const prevEnd = addDaysISO(range.start, -1);
  const prevStart = addDaysISO(prevEnd, -(days - 1));
  return { start: prevStart, end: prevEnd, label: "Previous period" };
}

/** Human day-group label for an expense_date string relative to today, e.g. "Today · Thu, 17 Sep" / "Yesterday · Wed, 16 Sep" / "Thu, 17 Sep". */
export function dayGroupLabel(iso: string): string {
  const today = getTodayISO();
  const yesterday = addDaysISO(today, -1);
  const dateObj = parseISODate(iso);
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: dateObj.getUTCFullYear() !== parseISODate(today).getUTCFullYear() ? "numeric" : undefined,
    timeZone: "UTC",
  });

  if (iso === today) return `Today · ${formattedDate}`;
  if (iso === yesterday) return `Yesterday · ${formattedDate}`;
  return formattedDate;
}

/** Short weekday+day label used for compact mobile chart axes, e.g. "12". */
export function shortDayLabel(iso: string): string {
  return String(parseISODate(iso).getUTCDate());
}
