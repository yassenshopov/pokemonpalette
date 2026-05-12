import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const VALID_PALETTE_SIZES = [3, 4, 5, 6] as const;

// GET - Get user's palette size preference
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { paletteSize: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const size = user.paletteSize ?? 3;
  const validSize = (VALID_PALETTE_SIZES as readonly number[]).includes(size)
    ? size
    : 3;

  return NextResponse.json({ paletteSize: validSize });
}

const PutSchema = z.object({
  paletteSize: z
    .number()
    .int()
    .refine((n) => (VALID_PALETTE_SIZES as readonly number[]).includes(n), {
      message: "paletteSize must be 3, 4, 5, or 6",
    }),
});

// PUT - Update user's palette size preference
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "paletteSize must be 3, 4, 5, or 6" },
      { status: 400 }
    );
  }

  try {
    // `updateMany` lets us scope the write to non-deleted users in a
    // single statement. The previous `update` + post-hoc isDeleted
    // check still wrote to the soft-deleted row before noticing the
    // flag — a banned/deleted user could keep mutating their stored
    // preferences indefinitely.
    const result = await prisma.user.updateMany({
      where: { id: userId, isDeleted: false },
      data: { paletteSize: parsed.data.paletteSize },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      paletteSize: parsed.data.paletteSize,
    });
  } catch (err) {
    logger.error("account.palette_preference.update_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to update palette preference" },
      { status: 500 }
    );
  }
}
