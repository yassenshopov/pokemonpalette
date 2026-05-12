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

/**
 * `RATE_LIMIT_DISABLE=1` lets us run the production build locally
 * (`next start`) for E2E tests without provisioning real Upstash
 * credentials. Without this escape hatch the hard-fail below would
 * make the prod build unbootable on a dev workstation.
 *
 * Set this ONLY in trusted environments. CI / preview / production
 * deployments should never carry this flag.
 */
const PROD_BYPASS = process.env.RATE_LIMIT_DISABLE === "1";

/**
 * Next.js sets `NEXT_PHASE` during build (`phase-production-build`),
 * page data collection, prerender, and runtime. The hard-fail below
 * must only fire at RUNTIME — during `next build`, route modules
 * are evaluated for metadata extraction in a sandbox that may not
 * carry runtime env vars (Vercel exposes "Runtime"-scoped vars
 * after build, "Build"-scoped during it; users routinely have
 * UPSTASH_* set as runtime-only). Crashing the build for a vars
 * mismatch that won't affect actual prod traffic was breaking
 * deploys for valid configurations.
 *
 * The phase string is stable across Next 13/14/15; we don't import
 * it from a Next-only module so this file can still be evaluated
 * in non-Next contexts (e.g. unit tests).
 */
const IS_BUILD_PHASE =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

function noop(name: string): RateLimiter {
  if (!warned.has(name)) {
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
    // Hard-fail in production. The previous behaviour silently
    // degraded to a no-op limiter, which meant a misconfigured
    // deployment (e.g. env var typo on a new project) would lose ALL
    // rate limiting — incl. the auth/billing surfaces — without any
    // alert. Crashing at boot surfaces the misconfig in deploy logs
    // immediately and is recoverable by setting the env var.
    //
    // We DO NOT throw during `next build` — the build phase
    // evaluates route modules without runtime env vars on Vercel
    // when UPSTASH_* are scoped to "Runtime" only. The build-time
    // no-op limiter is never reached by real traffic. At runtime
    // (cold start) the env check runs again and throws if still
    // unset, which is when the audit-mandated visibility kicks in.
    if (
      process.env.NODE_ENV === "production" &&
      !PROD_BYPASS &&
      !IS_BUILD_PHASE
    ) {
      throw new Error(
        `[rate-limit] ${name}: Upstash Redis is required in production. ` +
          `Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or ` +
          `KV_REST_API_URL + KV_REST_API_TOKEN). To bypass for a local ` +
          `production-build smoke test, set RATE_LIMIT_DISABLE=1 — never ` +
          `in a deployed environment.`
      );
    }
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
 * Number of trusted reverse-proxy hops in front of the application.
 *
 *   - Vercel: 1 (Vercel's edge appends the client IP as the LAST hop in
 *     `x-forwarded-for`; anything BEFORE that is attacker-controlled
 *     input on the original request).
 *   - Local dev / direct Node: 0 (no proxy at all; `x-real-ip` /
 *     `x-forwarded-for` are user-supplied if present).
 *
 * Override with the `TRUSTED_PROXY_HOPS` env var if you front the app
 * with extra L7 proxies (e.g. Cloudflare → Vercel = 2 hops). Default
 * matches the production deployment topology.
 */
function getTrustedHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;
function isPlausibleIp(value: string): boolean {
  return IPV4.test(value) || IPV6.test(value);
}

/**
 * Extract a client IP from the request headers. Used for anonymous rate
 * limiting. Returns "unknown" if no IP can be parsed.
 *
 * SECURITY: `x-forwarded-for` is APPENDED by each proxy hop. The
 * left-most entry is whatever the original client sent (which on the
 * public internet is attacker-controlled — anyone can set the header
 * before hitting our edge). Previously we returned `xff.split(",")[0]`
 * unconditionally, which let an attacker spoof any IP they wanted
 * for rate-limit bucketing — granting themselves an unlimited bucket
 * by rotating fake leading IPs. We now skip from the right, dropping
 * `TRUSTED_PROXY_HOPS` entries, and use the next one as the real IP.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
    const trusted = getTrustedHops();
    // With N trusted proxies in front of us, the rightmost N entries
    // are appended by our infra and are trustworthy; the (N+1)th from
    // the right is the real client. If the chain is shorter than the
    // expected trust depth, the request didn't traverse our edge —
    // we refuse to fish a client IP out of the attacker-controlled
    // prefix and return "unknown", so the rate limiter buckets it
    // under a single safe key instead of an attacker-spoofable one.
    if (trusted > 0 && hops.length >= trusted) {
      const candidate = hops[hops.length - trusted];
      if (candidate && isPlausibleIp(candidate)) return candidate;
    } else if (trusted === 0 && hops.length > 0) {
      const candidate = hops[0];
      if (candidate && isPlausibleIp(candidate)) return candidate;
    }
  }
  const real = req.headers.get("x-real-ip");
  if (real) {
    const trimmed = real.trim();
    if (isPlausibleIp(trimmed)) return trimmed;
  }
  return "unknown";
}
