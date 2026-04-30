import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the target Pokemon ID for a multiplayer room so the client can
 * extract its color palette. Only participants of the room can access this.
 *
 * Yes, a determined cheater could inspect this response — but the same is
 * true of the single-player mode where colors are extracted client-side.
 * The competitive fairness comes from both players seeing the same palette
 * at the same time, not from hiding the ID.
 */
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
    include: { players: { select: { userId: true } } },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isParticipant = room.players.some((p) => p.userId === userId);
  if (!isParticipant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  if (room.status === "waiting") {
    return NextResponse.json(
      { error: "Game has not started yet" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    pokemonId: room.targetPokemonId,
    isShiny: room.isShiny,
  });
}
