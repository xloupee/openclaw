/**
 * Rate limiting for inbound messages.
 * Tracks messages per user per channel within a sliding time window.
 */

type RateLimitEntry = {
  timestamps: number[];
};

type RateLimitCache = Map<string, RateLimitEntry>;

export type RateLimitChecker = {
  check: (key: string) => { allowed: boolean; resetInMs?: number; remaining?: number };
  clear: () => void;
  size: () => number;
};

/**
 * Create a rate limit checker with a sliding window.
 */
export function createRateLimitChecker(params: {
  maxPerWindow: number;
  windowMs?: number;
}): RateLimitChecker {
  const cache: RateLimitCache = new Map();
  const windowMs = params.windowMs ?? 3600000; // Default: 1 hour

  return {
    check: (key: string): { allowed: boolean; resetInMs?: number; remaining?: number } => {
      const now = Date.now();
      const entry = cache.get(key) ?? { timestamps: [] };

      // Filter to timestamps within the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= params.maxPerWindow) {
        // Rate limited - find when the oldest message will expire
        const oldestInWindow = Math.min(...entry.timestamps);
        const resetInMs = oldestInWindow + windowMs - now;
        return { allowed: false, resetInMs, remaining: 0 };
      }

      // Allowed - record this message
      entry.timestamps.push(now);
      cache.set(key, entry);

      const remaining = params.maxPerWindow - entry.timestamps.length;
      return { allowed: true, remaining };
    },

    clear: () => cache.clear(),

    size: () => cache.size,
  };
}

/**
 * Build a rate limit key from message context.
 */
export function buildRateLimitKey(params: {
  channel: string;
  accountId?: string;
  senderId: string;
}): string {
  const account = params.accountId?.trim() || "default";
  return `ratelimit:${params.channel}:${account}:${params.senderId}`;
}

/**
 * Format a rate limit reply message.
 */
export function formatRateLimitReply(resetInMs: number): string {
  const minutes = Math.ceil(resetInMs / 60000);
  if (minutes <= 1) {
    return "Rate limited. You can send messages again in about 1 minute.";
  }
  return `Rate limited. You can send messages again in ${minutes} minutes.`;
}

// Global rate limiter instance (initialized lazily)
let globalRateLimiter: RateLimitChecker | null = null;

/**
 * Get or create the global rate limiter.
 */
export function getGlobalRateLimiter(config?: {
  enabled?: boolean;
  messagesPerHour?: number;
}): RateLimitChecker | null {
  if (config?.enabled === false) {
    return null;
  }

  if (!globalRateLimiter) {
    globalRateLimiter = createRateLimitChecker({
      maxPerWindow: config?.messagesPerHour ?? 5,
      windowMs: 3600000, // 1 hour
    });
  }

  return globalRateLimiter;
}

/**
 * Reset the global rate limiter (for testing or config reload).
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}
