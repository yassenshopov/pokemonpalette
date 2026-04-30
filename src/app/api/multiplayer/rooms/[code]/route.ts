import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(
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
    include: {
      players: {
        select: {
          userId: true,
          username: true,
          imageUrl: true,
          attempts: true,
          won: true,
          bestSimilarity: true,
          hintsUsed: true,
          finishedAt: true,
          guesses: true,
        },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (new Date() > room.expiresAt) {
    return NextResponse.json({ error: "Room has expired" }, { status: 410 });
  }

  const isParticipant = room.players.some((p) => p.userId === userId);
  if (!isParticipant && room.status !== "waiting") {
    return NextResponse.json({ error: "Room is not joinable" }, { status: 403 });
  }

  const players = room.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    imageUrl: p.imageUrl,
    attempts: p.attempts,
    won: p.won,
    bestSimilarity: p.bestSimilarity,
    hintsUsed: p.hintsUsed,
    finished: !!p.finishedAt,
    guesses: p.userId === userId ? p.guesses : p.attempts,
  }));

  return NextResponse.json({
    roomCode: room.roomCode,
    roomId: room.id,
    hostUserId: room.hostUserId,
    targetPokemonId:
      room.status === "finished" ? room.targetPokemonId : undefined,
    isShiny: room.isShiny,
    status: room.status,
    winnerUserId: room.winnerUserId,
    players,
    expiresAt: room.expiresAt.toISOString(),
  });
}
