import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET - Get user's daily-email preference
export async function GET() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    logger.error("auth.service_unavailable", {
      route: "/api/account/email-preference",
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { receivesDailyEmails: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    receivesDailyEmails: user.receivesDailyEmails ?? true,
  });
}

const PutSchema = z.object({ receivesDailyEmails: z.boolean() });

// PUT - Update user's daily-email preference
export async function PUT(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

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
      { error: "receivesDailyEmails must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { receivesDailyEmails: parsed.data.receivesDailyEmails },
      select: { receivesDailyEmails: true, isDeleted: true },
    });

    // Guard against touching a soft-deleted user — Prisma's `update` has
    // no compound where clause option, so we enforce it here.
    if (user.isDeleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      receivesDailyEmails: user.receivesDailyEmails,
    });
  } catch (err) {
    logger.error("account.email_preference.update_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to update email preference" },
      { status: 500 }
    );
  }
}
