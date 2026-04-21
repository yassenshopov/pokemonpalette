import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma, prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// DELETE - Remove a saved palette. Ownership is checked inside the query
// (user_id matches the caller), which both avoids the extra round trip and
// closes the ownership-check TOCTOU window that the previous select-then-
// delete had.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("auth.service_unavailable", {
      route: "/api/saved-palettes/[id]",
      error: authError instanceof Error ? authError.message : String(authError),
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Palette ID is required" },
      { status: 400 }
    );
  }

  try {
    // deleteMany + { id, userId } returns { count } — a 0 there means
    // either the palette doesn't exist or the caller doesn't own it.
    // We deliberately return the same 404 for both cases so a probing
    // attacker can't enumerate valid palette ids.
    const result = await prisma.savedPalette.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Palette deleted successfully" });
  } catch (err) {
    // Invalid UUID string → Prisma throws PrismaClientValidationError /
    // PrismaClientKnownRequestError. Treat as 404.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }
    logger.error("saved-palettes.delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to delete palette" }, { status: 500 });
  }
}
