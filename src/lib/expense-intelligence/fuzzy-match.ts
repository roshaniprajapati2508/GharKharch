// Lightweight typo-tolerant matching for the expense-intelligence suggesters
// (spec: "Fuzzy Typo & Phonetic Match" - tolerate 1-2 edit-distance mistakes
// from fast mobile typing, e.g. "ygesh" for "yogesh", "maruty" for "maruti",
// "kheero" for "khiru", "xrox" for "xerox").
//
// Deliberately dependency-free: a classic Levenshtein distance is short
// enough to own directly, and this codebase avoids pulling in third-party
// fuzzy-search/NLP libraries for something this small. This is NOT a
// substring search (use `.includes()` for that) - it's specifically for
// tolerating a garbled *word*, so exact/substring matching should always be
// tried first and this used only as a fallback when that finds nothing.

/** Classic Levenshtein edit distance between two strings. Case-sensitive - callers normalize case first. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insertion
        prevRow[j] + 1, // deletion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currRow;
  }

  return prevRow[b.length];
}

/**
 * How many typo'd characters to tolerate for a word of this length - short
 * words get 1, longer words get 2. Never more than 2: beyond that, matches
 * start feeling random rather than "typo-tolerant" (spec caps this at 1-2).
 */
function editToleranceForLength(len: number): number {
  return len <= 4 ? 1 : 2;
}

/**
 * True if two single words are a plausible typo of one another. Case-
 * insensitive. Deliberately conservative: both words need at least 3
 * characters (2-letter words produce too many false positives), and their
 * length difference can't exceed the tolerance either.
 */
export function isFuzzyWordMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length < 3 || y.length < 3) return false;

  const tolerance = editToleranceForLength(Math.max(x.length, y.length));
  if (Math.abs(x.length - y.length) > tolerance) return false;

  return levenshteinDistance(x, y) <= tolerance;
}

/**
 * True if `needle` plausibly appears within `haystack`, tolerating 1-2
 * character typos in individual words. Checks exact substring containment
 * first (cheap, and correctly-spelled text should never fall through to the
 * fuzzy path), then compares `needle`'s words against `haystack`'s words
 * (every word in `needle` must fuzzy-match some word in `haystack`, so a
 * multi-word needle like "yogesh bhai" only matches when both words are
 * plausibly present).
 */
export function fuzzyMatches(haystack: string, needle: string): boolean {
  if (typeof haystack !== "string" || typeof needle !== "string") return false;
  const h = haystack.trim().toLowerCase();
  const n = needle.trim().toLowerCase();
  if (!h || !n) return false;
  if (h.includes(n)) return true;

  const haystackWords = h.split(/\s+/).filter(Boolean);
  const needleWords = n.split(/\s+/).filter(Boolean);
  if (needleWords.length === 0 || haystackWords.length === 0) return false;

  return needleWords.every((nw) => haystackWords.some((hw) => isFuzzyWordMatch(hw, nw)));
}
