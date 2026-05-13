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
 * `RATE_LIMIT_DISABLE=1` historically suppressed a hard-fail when
 * Upstash credentials were absent (so `next start` could boot for
 * local E2E tests). The factory below no longer throws, so this flag
 * is functionally a no-op — kept in the schema (`src/lib/env.ts`) and
 * referenced in `rateLimit()` so external runbooks pointing at it
 * don't suddenly fail Zod validation. Safe to remove once those
 * runbooks are updated.
 */
const PROD_BYPASS = process.env.RATE_LIMIT_DISABLE === "1";

/**
 * Next.js sets `NEXT_PHASE` during build (`phase-production-build`),
 * page data collection, prerender, and runtime. Tracked here so the
 * factory can branch on build vs. runtime if future hardening needs
 * to behave differently per phase. Currently informational only —
 * see the `void IS_BUILD_PHASE` in `rateLimit()` below.
 */
const IS_BUILD_PHASE =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

function noop(name: string): RateLimiter {
  if (!warned.has(name)) {
    warned.add(name);
    // Prod incidents are easy to miss in a warn-level log stream. We
    // surface the missing-Upstash case at error level in production so
    // it shows up in Vercel's "Errors" tab and any Sentry / Datadog
    // pipe wired off `console.error`. Dev keeps the quieter warn —
    // running without Upstash is the normal local-dev path.
    const log =
      process.env.NODE_ENV === "production" ? console.error : console.warn;
    log(
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
    // We previously THREW here in production to surface the missing
    // env var in deploy logs. That was the wrong placement: every
    // route does `const x = rateLimit(...)` at module top-level, so a
    // throw here kills the entire route module on cold start and
    // Next.js falls back to a generic 500. A single missing env var
    // bricked every write endpoint until Upstash was provisioned.
    //
    // The audit's intent — "don't silently drop rate limiting in
    // prod" — is still honoured: `noop()` now logs at error level in
    // production (visible in Vercel "Errors" + any logger pipe). For
    // security-critical surfaces that MUST have a real limiter (e.g.
    // api-key minting, billing checkout) call `requireRealLimiter()`
    // alongside `rateLimit()` and surface a 503 from the handler;
    // that fails closed for the specific request without poisoning
    // module evaluation for the entire route file.
    //
    // PROD_BYPASS / IS_BUILD_PHASE are kept for symmetry with the
    // matching env-var schema in src/lib/env.ts; they currently
    // affect nothing because we no longer throw.
    void PROD_BYPASS;
    void IS_BUILD_PHASE;
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
