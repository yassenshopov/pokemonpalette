import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashKey } from "@/lib/api-keys";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit("api-v1", { requests: 600, window: "1 m" });

export type ApiAuthResult =
  | { ok: true; userId: string; keyId: string }
  | { ok: false; response: NextResponse };

export async function requireApiKey(req: Request): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing or malformed Authorization header. Expected: Bearer pkpal_..." },
        { status: 401 },
      ),
    };
  }

  const plain = authHeader.slice(7);
  if (!plain.startsWith("pkpal_")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key format" },
        { status: 401 },
      ),
    };
  }

  const keyHash = hashKey(plain);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

  // Unify the "unknown key" and "revoked key" responses. Returning
  // 401/"Invalid API key" for one and 403/"API key has been revoked"
  // for the other was a small but real enumeration oracle: an attacker
  // probing leaked keys could distinguish between "this hash was never
  // valid" and "this hash was once valid but is now revoked", which
  // in turn confirms that the redacted/leaked prefix really did
  // correspond to a real account. Both paths now return the same
  // {401, "Invalid API key"} shape — the audit log retains enough
  // detail (revokedAt timestamp lives on the row) for an operator to
  // tell them apart server-side.
  if (!apiKey || apiKey.revokedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      ),
    };
  }

  const rl = await limiter.check(apiKey.id);
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString(),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        },
      ),
    };
  }

  // Fire-and-forget last_used_at update
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ok: true, userId: apiKey.userId, keyId: apiKey.id };
}
