import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

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

  const room = await prisma.multiplayerRoom.findUnique({
    where: { roomCode: code.toUpperCase() },
    include: { players: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "playing") {
    return NextResponse.json(
      { error: "Game is not in progress" },
      { status: 400 }
    );
  }

  const player = room.players.find((p) => p.userId === userId);
  if (!player) {
    return NextResponse.json(
      { error: "You are not in this room" },
      { status: 403 }
    );
  }

  if (player.finishedAt) {
    return NextResponse.json(
      { error: "You have already finished" },
      { status: 400 }
    );
  }

  try {
    await prisma.multiplayerPlayer.update({
      where: { id: player.id },
      data: { finishedAt: new Date() },
    });

    const otherPlayers = room.players.filter((p) => p.userId !== userId);
    const allFinished = otherPlayers.every((p) => !!p.finishedAt);

    if (allFinished) {
      let winnerUserId: string | null = null;
      const winners = otherPlayers.filter((p) => p.won);
      if (winners.length === 1 && winners[0]) {
        winnerUserId = winners[0].userId;
      } else if (winners.length === 0) {
        const sorted = [...otherPlayers].sort(
          (a, b) => b.bestSimilarity - a.bestSimilarity
        );
        const top = sorted[0];
        if (top && top.bestSimilarity > 0) {
          winnerUserId = top.userId;
        }
      }

      await prisma.multiplayerRoom.update({
        where: { id: room.id },
        data: {
          status: "finished",
          winnerUserId,
          finishedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      message: "You gave up",
      targetPokemonId: room.targetPokemonId,
    });
  } catch (err) {
    logger.error("multiplayer.give_up_failed", {
      userId,
      roomCode: code,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to process give up" },
      { status: 500 }
    );
  }
}
