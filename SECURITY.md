# Security notes

Short reference for security-relevant patterns used across the codebase.
Audit findings are tracked in the `.audit-*.md` files at the repo root;
this file documents the *current shipped* behaviour for things that
don't have an obvious code location.

## CSRF

The app does not implement a custom CSRF token / double-submit cookie
scheme. The combination below provides equivalent protection for our
attack surface:

1. **Cookie-auth surface (Clerk session):** Clerk issues `__session`
   with `SameSite=Lax` by default and `SameSite=Strict` on the
   sign-in endpoints. SameSite=Lax blocks cross-site `POST` /
   `DELETE` / `PATCH` cookies — which is the only vector CSRF tokens
   would catch.
2. **Server validation:** every mutating route re-reads the Clerk
   session via `auth()` inside the handler and checks `userId` /
   admin status against the DB. No mutating handler trusts a value
   carried only by the cookie.
3. **API-key surface (`/api/v1/*`):** auth is `Authorization: Bearer
   pkpal_...`, never a cookie. Browsers don't auto-attach `Authorization`
   to cross-origin requests, so CSRF is structurally impossible — an
   attacker would need the key itself, at which point CSRF is the
   least of the user's worries.
4. **Webhooks (`/api/webhooks/clerk`, `/api/billing/webhook`):**
   signature-verified (svix / Stripe) BEFORE any side effects. No
   cookie auth involved.

If a handler ever needs to be invoked from a non-Clerk-authenticated
caller via cookie, add a CSRF token — but as of this writing nothing
fits that shape.

## API keys

- Stored hashed in `api_keys.key_hash`.
- Hashing is **HMAC-SHA256** with `API_KEY_HASH_SECRET` (see
  `src/lib/api-keys.ts`). The previous scheme was plain SHA-256;
  the dual-lookup path in `requireApiKey` still accepts legacy
  hashes for backwards compatibility with un-rotated keys.
- Plain key is only present in memory at issue time, sent once in
  the post-checkout email, and never written back to the DB.
- Lookup uses constant-time comparison via Prisma's indexed
  `keyHash IN (...)` query — both candidate hashes hit the unique
  index, so there's no timing side-channel from a "found / not
  found" branch on a single hash.

## Rate limiting

- Production: hard-fail at boot if Upstash Redis env vars are missing
  (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or
  `KV_REST_API_URL` / `KV_REST_API_TOKEN`).
- Dev/preview: no-op limiter with a one-time warning per process.
- Local prod-build smoke test: set `RATE_LIMIT_DISABLE=1`. **Never**
  set this in a deployed environment.

## Trusted proxy hops

`getClientIp` (in `src/lib/rate-limit.ts`) skips `TRUSTED_PROXY_HOPS`
entries from the right of `X-Forwarded-For`. Default 1 (Vercel
edge). Set higher if you front the app with Cloudflare or another
L7 proxy. Setting it lower than the real proxy depth lets attackers
spoof IPs for rate-limit bucketing.

## Webhook idempotency

Stripe and Clerk webhooks share `processed_webhook_events` (PK
`(provider, event_id)`). The handler inserts inside the same
transaction as its side-effects; a unique-constraint violation
signals a replay and the handler 200s without re-running. See
`supabase/migrations/026_webhook_event_idempotency.sql`.

## Admin gate

`requireAdmin` (in `src/lib/admin/auth.ts`) verifies on EVERY admin
request that the caller's `users` row is non-deleted, non-banned,
non-locked, and `is_admin: true`. The Clerk session claim is only
used as a fast-reject for non-admins (skip the DB hit when the
claim is missing/false). A banned admin loses access immediately,
without waiting for the JWT to expire.
