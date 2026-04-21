/**
 * Rate limiting wrapper.
 *
 * Uses @upstash/ratelimit when the Upstash env vars are set
 * (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — also published as
 * KV_REST_API_URL / KV_REST_API_TOKEN on Vercel KV). Falls back to a no-op
 * in any other environment so local dev / preview without Redis configured
 * still works. The no-op logs a single warning per process so it's visible
 * during development.
 *
 * Usage:
 *   const rl = rateLimit("dga-post", { requests: 30, window: "1 m" });
 *   const { allowed } = await rl.check(userId ?? ip);
 *   if (!allowed) return NextResponse.json({ error: "Too many" }, { status: 429 });
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Duration =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

export interface RateLimitConfig {
  requests: number;
  window: Duration;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (err) {
    console.error("Failed to init Upstash Redis client:", err);
    return null;
  }
}

const warned = new Set<string>();

function noop(name: string): RateLimiter {
  if (!warned.has(name) && process.env.NODE_ENV !== "production") {
    warned.add(name);
    console.warn(
      `[rate-limit] ${name}: Upstash not configured, requests will not be rate-limited. ` +
        `Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN) to enable.`
    );
  }
  return {
    async check(): Promise<RateLimitResult> {
      return {
        allowed: true,
        limit: Number.POSITIVE_INFINITY,
        remaining: Number.POSITIVE_INFINITY,
        resetAt: 0,
      };
    },
  };
}

export interface RateLimiter {
  check(identifier: string): Promise<RateLimitResult>;
}

const limiters = new Map<string, RateLimiter>();

/**
 * Build (or reuse) a named rate limiter. Using a sliding window keeps the
 * math well-behaved at bucket boundaries.
 */
export function rateLimit(
  name: string,
  config: RateLimitConfig
): RateLimiter {
  const cached = limiters.get(name);
  if (cached) return cached;

  const redis = getRedis();
  if (!redis) {
    const limiter = noop(name);
    limiters.set(name, limiter);
    return limiter;
  }

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: false,
    prefix: `ratelimit:${name}`,
  });

  const limiter: RateLimiter = {
    async check(identifier: string): Promise<RateLimitResult> {
      try {
        const res = await rl.limit(identifier);
        return {
          allowed: res.success,
          limit: res.limit,
          remaining: res.remaining,
          resetAt: res.reset,
        };
      } catch (err) {
        // Fail open: Redis hiccups should NOT drop real traffic.
        console.error(`[rate-limit] ${name}: Upstash error, failing open:`, err);
        return {
          allowed: true,
          limit: config.requests,
          remaining: 0,
          resetAt: Date.now() + 60_000,
        };
      }
    },
  };

  limiters.set(name, limiter);
  return limiter;
}

/**
 * Extract a client IP from the request headers. Used for anonymous rate
 * limiting. Returns "unknown" if no IP can be parsed.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
