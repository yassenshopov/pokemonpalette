import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const attempt = await prisma.dailyGameAttempt.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        user_id: attempt.userId,
        date: attempt.date.toISOString().slice(0, 10),
        target_pokemon_id: attempt.targetPokemonId,
        is_shiny: attempt.isShiny,
        guesses: attempt.guesses,
        attempts: attempt.attempts,
        won: attempt.won,
        pokemon_guessed: attempt.pokemonGuessed,
        hints_used: attempt.hintsUsed,
        created_at: attempt.createdAt.toISOString(),
        updated_at: attempt.updatedAt.toISOString(),
      },
      user: attempt.user
        ? {
            id: attempt.user.id,
            email: attempt.user.email,
            username: attempt.user.username,
            first_name: attempt.user.firstName,
            last_name: attempt.user.lastName,
            image_url: attempt.user.imageUrl,
            profile_image_url: attempt.user.profileImageUrl,
          }
        : null,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    logger.error("admin.game-data.get_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const before = await prisma.dailyGameAttempt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        date: true,
        targetPokemonId: true,
        isShiny: true,
        attempts: true,
        won: true,
        hintsUsed: true,
        createdAt: true,
      },
    });

    const result = await prisma.dailyGameAttempt.deleteMany({ where: { id } });
    if (result.count === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    void recordAudit({
      actorUserId: gate.adminUserId,
      action: "game_data.delete",
      targetType: "daily_game_attempt",
      targetId: id,
      before,
      after: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    logger.error("admin.game-data.delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to delete attempt" },
      { status: 500 },
    );
  }
}
