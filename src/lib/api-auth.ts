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

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      ),
    };
  }

  if (apiKey.revokedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "API key has been revoked" },
        { status: 403 },
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
