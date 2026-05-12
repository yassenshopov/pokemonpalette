import { z } from "zod";

/**
 * Validated environment variables.
 *
 * This module is the only place that reads `process.env` for required
 * configuration. It runs Zod validation at module-load time so misconfigured
 * deployments fail fast (with a readable error) instead of silently exploding
 * on the first request.
 *
 * Split into `server` (secrets, must never reach the browser) and `client`
 * (NEXT_PUBLIC_*, allowed in the bundle). Client vars are inlined at build
 * time by Next.js, so we validate them against the `process.env` snapshot.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase — used for SECURITY DEFINER RPC calls only.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Prisma — runtime pooled, migration direct.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Clerk server-side.
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Email sending (optional).
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().min(1).optional(),

  // Stripe billing (optional — only required when the API checkout
  // flow is enabled). Validated here so a typo in the dashboard
  // surfaces at deploy time instead of silently 500-ing the first
  // checkout attempt.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PALETTE_API_PRICE_ID: z.string().min(1).optional(),

  // Upstash / Vercel KV rate limiting (optional — falls back to noop
  // in dev; rate-limit.ts hard-fails in production if neither pair is
  // configured, so the optionality here is for local-dev convenience).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),

  // Local-dev / smoke-test escape hatch for the rate limiter. Should
  // never be set in deployed environments — guarded against in
  // src/lib/rate-limit.ts.
  RATE_LIMIT_DISABLE: z.enum(["0", "1"]).optional(),

  // Logger threshold + Prisma query log level (verbose, opt-in).
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  PRISMA_LOG: z.enum(["query"]).optional(),

  // Server-side secret used to HMAC `pkpal_*` API keys before they hit the
  // database. Without this, the DB stores plain SHA-256(plain_key) — anyone
  // with a dump can run an offline GPU sweep across the 24-byte token space
  // and confirm specific candidates. Mixing in a server secret turns that
  // into "you need the DB dump AND the secret", which is the same posture
  // we already require for everything signed (Clerk JWT, Stripe webhook).
  //
  // Optional at the schema level so dev/preview without billing wired up
  // still boot. `api-keys.ts` falls back to legacy SHA-256 when this is
  // unset and `api-auth.ts` dual-looks-up. In production with API access
  // enabled, this MUST be set — see the runtime check in `api-keys.ts`.
  API_KEY_HASH_SECRET: z.string().min(32).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_GA4_ID: z.string().min(1).optional(),
});

function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Throwing here turns a missing env into a hard-fail at import time,
    // which is the behaviour we want in prod (Next will surface it in the
    // build / startup logs) and in dev (visible error instead of a silent
    // undefined downstream).
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
}

// On the client, only NEXT_PUBLIC_* is populated. We deliberately don't parse
// the server schema in the browser — Next.js will have stripped secrets out,
// and attempting to validate them would always fail.
const isServer = typeof window === "undefined";

export const clientEnv = parseEnv(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
  },
  "client",
);

export const serverEnv = isServer
  ? parseEnv(serverSchema, process.env, "server")
  : // On the client, accessing serverEnv is a bug — return a Proxy that
    // throws so we catch it in dev instead of quietly returning undefined.
    (new Proxy({} as z.infer<typeof serverSchema>, {
      get(_, prop) {
        throw new Error(
          `serverEnv.${String(prop)} accessed on the client. Move this code to a server module.`,
        );
      },
    }) as z.infer<typeof serverSchema>);

export type ClientEnv = typeof clientEnv;
export type ServerEnv = typeof serverEnv;
