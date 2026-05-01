import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateKey } from "@/lib/api-keys";
import { logger } from "@/lib/logger";
import { z } from "zod";

const MAX_KEYS_PER_USER = 5;

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

  if (!(await hasApiAccess(userId))) {
    return NextResponse.json(
      { error: "No active API subscription" },
      { status: 403 },
    );
  }

  const activeCount = await prisma.apiKey.count({
    where: { userId, revokedAt: null },
  });
  if (activeCount >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_KEYS_PER_USER} active keys allowed` },
      { status: 409 },
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

  try {
    const key = await prisma.apiKey.create({
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

    return NextResponse.json({ key: { ...key, plainKey: plain } });
  } catch (err) {
    logger.error("api-keys.create_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }
}
