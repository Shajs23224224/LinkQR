type RateBucket = {
  windowStartedAt: number;
  count: number;
};

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export class AuthRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(private readonly configs: Record<string, RateLimitConfig>) {}

  check(key: string, action: string, now = Date.now()): {
    allowed: boolean;
    retryAfterSeconds: number;
  } {
    const config = this.configs[action];
    if (!config) return { allowed: true, retryAfterSeconds: 0 };

    const bucketKey = `${action}:${key}`;
    const current = this.buckets.get(bucketKey);

    if (!current || now - current.windowStartedAt >= config.windowMs) {
      this.buckets.set(bucketKey, {
        windowStartedAt: now,
        count: 1
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= config.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((config.windowMs - (now - current.windowStartedAt)) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  prune(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      const action = key.slice(key.indexOf(":") + 1);
      const config = this.configs[action];
      if (!config || now - bucket.windowStartedAt >= config.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
