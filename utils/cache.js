/**
 * In-Memory High-Performance Cache Utility for SVVV_Notes
 *
 * Provides sub-millisecond in-memory caching for read-heavy, slow, or aggregate queries
 * (such as homepage active subjects, latest notes, and sitemap XML).
 * Includes safe automatic TTL expiration, memory eviction limits, and pattern invalidation.
 */

class MemoryCache {
  constructor(maxEntries = 1000) {
    this.store = new Map();
    this.maxEntries = maxEntries;
  }

  /**
   * Retrieve a value from the cache.
   * Returns undefined if key is missing or expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a key-value pair in cache with an optional TTL in seconds.
   */
  set(key, value, ttlSeconds = 300) {
    // Evict oldest entry if size limit reached
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Delete a specific key.
   */
  del(key) {
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix or wildcard pattern (e.g. "home:*", "notes:*").
   */
  invalidate(pattern) {
    if (!pattern) return;
    const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*"));
    for (const key of this.store.keys()) {
      if (regexPattern.test(key)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cached items.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Cache-aside helper: returns cached value or executes fn(), caches the result, and returns it.
   */
  async wrap(key, ttlSeconds, fn) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = await fn();
    this.set(key, result, ttlSeconds);
    return result;
  }
}

const cache = new MemoryCache(500);

module.exports = cache;
