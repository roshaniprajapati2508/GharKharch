/**
 * In-memory client-side cache for caching Server Action data across tab switches.
 * Survives component unmounts during client-side navigation within the session.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const clientMemoryCache = new Map<string, CacheEntry<unknown>>();

export function getClientCachedData<T>(key: string, maxAgeMs: number = 60_000): T | null {
  if (typeof window === "undefined") return null;
  const entry = clientMemoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAgeMs) {
    clientMemoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setClientCachedData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  clientMemoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
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
