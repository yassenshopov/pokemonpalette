import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma, prisma } from "@/lib/prisma";
import { generateKey } from "@/lib/api-keys";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const MAX_KEYS_PER_USER = 5;

// Cap key minting at 10/min per user. The Serializable transaction
// below already prevents exceeding MAX_KEYS_PER_USER, but a tight
// create/revoke loop could still generate hundreds of audit-noisy
// rows per second; the limiter both protects the DB and shields
// downstream notification systems.
const createKeyLimiter = rateLimit("account-api-keys-create", {
  requests: 10,
  window: "1 m",
});

async function getAuthedUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

async function hasApiAccess(userId: string): Promise<boolean> {
  const [customer, user] = await Promise.all([
    prisma.apiCustomer.findUnique({
      where: { userId },
      select: { status: true },
    }),
    prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { isAdmin: true },
    }),
  ]);
  return customer?.status === "active" || !!user?.isAdmin;
}

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasApiAccess(userId))) {
    return NextResponse.json(
      { error: "No active API subscription" },
      { status: 403 },
    );
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

const CreateKeyBody = z.object({
  name: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await createKeyLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!(await hasApiAccess(userId))) {
    return NextResponse.json(
      { error: "No active API subscription" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof CreateKeyBody> = {};
  try {
    const raw = await req.json();
    const parsed = CreateKeyBody.safeParse(raw);
    if (parsed.success) body = parsed.data;
  } catch {
    // empty body is fine
  }

  const { plain, hash, prefix } = generateKey();

  // TOCTOU fix: previously this route did `count → create` as two
  // independent queries. A user (or a stuck retry loop) could fire
  // N concurrent POSTs, all of them would observe `count < 5`, and
  // all of them would insert — so the "max 5 keys" limit silently
  // turned into "max 5 + concurrent requests". We now do both the
  // count and the conditional insert inside a Serializable
  // transaction; a concurrent winner causes the loser to either see
  // the updated count (and abort with 409) or hit a serialization
  // conflict that bubbles up as P2034 and translates to 409 too.
  let key;
  try {
    key = await prisma.$transaction(
      async (tx) => {
        const activeCount = await tx.apiKey.count({
          where: { userId, revokedAt: null },
        });
        if (activeCount >= MAX_KEYS_PER_USER) {
          throw new ApiKeyLimitError();
        }
        return tx.apiKey.create({
          data: {
            userId,
            keyHash: hash,
            keyPrefix: prefix,
            name: body.name ?? null,
          },
          select: {
            id: true,
            keyPrefix: true,
            name: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof ApiKeyLimitError) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_KEYS_PER_USER} active keys allowed` },
        { status: 409 },
      );
    }
    // Postgres serialization_failure surfaces as P2034 in Prisma.
    // Treat it as a friendlier 409 because the natural retry from
    // the client will succeed if there's actually capacity.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Concurrent request, please retry" },
        { status: 409 },
      );
    }
    logger.error("api-keys.create_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }

  return NextResponse.json({ key: { ...key, plainKey: plain } });
}

/** Sentinel thrown inside the API-key creation transaction when the
 *  caller is already at the per-user limit. Translated to a 409 by the
 *  outer handler. Kept private to this module — callers should rely on
 *  the HTTP status, not the error type. */
class ApiKeyLimitError extends Error {
  constructor() {
    super("API key limit reached");
    this.name = "ApiKeyLimitError";
  }
}
