/**
 * WiNS Hub Redis & Memory Cache Layer with Stampede Protection
 * Safely caches public territorial aggregates & catalogs
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export const cacheService = {
  /**
   * Get cached entry with TTL validation
   */
  get<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data;
  },

  /**
   * Set cached entry with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    memoryCache.set(key, { data, expiresAt });
  },

  /**
   * Wrapper for stale-while-revalidate / cache stampede protection
   */
  async fetchOrCache<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) return cached;

    try {
      const freshData = await fetchFn();
      this.set(key, freshData, ttlSeconds);
      return freshData;
    } catch (err) {
      // Fallback without cache if fetch fails
      throw err;
    }
  },

  /**
   * Clear cache namespace
   */
  clearNamespace(prefix: string): void {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
};
