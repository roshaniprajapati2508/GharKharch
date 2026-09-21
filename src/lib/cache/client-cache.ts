/**
 * In-memory client-side cache for caching Server Action and lookup data across tab switches.
 * Survives component unmounts during client-side navigation within the session.
 * Includes promise deduplication and stale-while-revalidate capabilities.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const clientMemoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_CACHE_TTL_MS = 3 * 60_000; // 3 minutes fresh window

export function getClientCachedData<T>(key: string, maxAgeMs: number = DEFAULT_CACHE_TTL_MS): T | null {
  if (typeof window === "undefined") return null;
  const entry = clientMemoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAgeMs) {
    clientMemoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Returns cached data if available, regardless of whether it is slightly stale,
 * allowing optimistic instant rendering.
 */
export function getStaleClientCachedData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const entry = clientMemoryCache.get(key);
  return entry ? (entry.data as T) : null;
}

export function setClientCachedData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  clientMemoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Deduplicates in-flight promises so multiple components requesting the same data key
 * simultaneously will share a single server round-trip.
 */
export async function dedupeFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

export function invalidateClientCache(keyPrefix?: string): void {
  if (typeof window === "undefined") return;
  if (!keyPrefix) {
    clientMemoryCache.clear();
    return;
  }
  for (const key of clientMemoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      clientMemoryCache.delete(key);
    }
  }
}
