import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

const PREFIX = "pkpal_";

/**
 * API key hashing.
 *
 * Old scheme (legacy keys in DB): `keyHash = sha256(plain)`. A leaked DB
 * dump lets an attacker run a GPU sweep against the 24-byte base64url
 * token space and confirm specific candidates offline — the audit's
 * Crit-class finding.
 *
 * New scheme: `keyHash = HMAC-SHA256(API_KEY_HASH_SECRET, plain)`. The
 * secret never leaves the server, so a DB dump is now insufficient to
 * brute-force the key. The brute force still costs the same, but the
 * attacker has to obtain the secret separately (a different blast
 * radius — same posture as JWT signing keys and webhook secrets).
 *
 * Migration: we do NOT rotate existing rows (impossible — we never
 * stored the plain key). On lookup we compute BOTH hashes and check
 * each. New keys are stored as HMAC-only. Legacy keys keep working
 * until they're individually rotated by the user. After a deprecation
 * window the legacy fallback in `api-auth.ts` can be deleted.
 */

function getSecret(): string | null {
  return serverEnv.API_KEY_HASH_SECRET ?? null;
}

/** Legacy hash. Only used during the dual-lookup migration window. */
export function hashKeyLegacy(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** HMAC-SHA256 hash with the server secret. Preferred path. */
export function hashKeyHmac(plain: string, secret: string): string {
  return createHmac("sha256", secret).update(plain).digest("hex");
}

/**
 * Compute the hash to store for a NEW key. Prefers HMAC when the
 * secret is configured; falls back to legacy SHA-256 in dev / preview
 * where the secret may be omitted. The matching lookup path in
 * `api-auth.ts` compares both, so a dev-issued legacy key keeps
 * working after the secret is added later.
 */
export function hashKey(plain: string): string {
  const secret = getSecret();
  return secret ? hashKeyHmac(plain, secret) : hashKeyLegacy(plain);
}

/**
 * Compute every hash that could match `plain` in the DB. The dual
 * lookup in `api-auth.ts` walks this list; the first row with a
 * matching `keyHash` is the authenticated key.
 *
 * Order is deliberate — the HMAC hash is first because that's the
 * fast path for keys minted after the secret was provisioned.
 */
export function candidateHashes(plain: string): string[] {
  const secret = getSecret();
  if (secret) return [hashKeyHmac(plain, secret), hashKeyLegacy(plain)];
  return [hashKeyLegacy(plain)];
}

/**
 * Constant-time string compare for hex hashes. Used by anything that
 * needs to compare a derived hash to a known one without leaking
 * timing — even though the DB lookup is the primary check, downstream
 * code that compares hashes inline should use this helper.
 */
export function safeHashEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export function generateKey(): { plain: string; hash: string; prefix: string } {
  const raw = randomBytes(24);
  const token = raw.toString("base64url");
  const plain = `${PREFIX}${token}`;
  return {
    plain,
    hash: hashKey(plain),
    prefix: token.slice(0, 8),
  };
}
