import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma, prisma } from "@/lib/prisma";
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

  const upperCode = code.toUpperCase();

  // Atomicity: the player "finishedAt" update + the (optional) room
  // finalization used to run as two separate, sequential statements.
  // If two players gave up (or one gave up while the other was racing
  // a winning guess) within the same Postgres round-trip, both could
  // observe an in-progress room and both write `status: finished`
  // with different winners — leaderboard scrambled. Serializable
  // isolation forces one of the concurrent finishers to retry; the
  // loser then sees the already-finished state and bails out.
  let outcome:
    | { kind: "ok"; targetPokemonId: number }
    | { kind: "not_found" }
    | { kind: "not_playing" }
    | { kind: "not_in_room" }
    | { kind: "already_finished" };

  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const room = await tx.multiplayerRoom.findUnique({
          where: { roomCode: upperCode },
          include: { players: true },
        });

        if (!room) return { kind: "not_found" as const };
        if (room.status !== "playing") {
          return { kind: "not_playing" as const };
        }

        const player = room.players.find((p) => p.userId === userId);
        if (!player) return { kind: "not_in_room" as const };
        if (player.finishedAt) {
          return { kind: "already_finished" as const };
        }

        await tx.multiplayerPlayer.update({
          where: { id: player.id },
          data: { finishedAt: new Date() },
        });

        const otherPlayers = room.players.filter((p) => p.userId !== userId);
        const allFinished =
          otherPlayers.length > 0 &&
          otherPlayers.every((p) => !!p.finishedAt);

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

          await tx.multiplayerRoom.update({
            where: { id: room.id },
            data: {
              status: "finished",
              winnerUserId,
              finishedAt: new Date(),
            },
          });
        }

        return { kind: "ok" as const, targetPokemonId: room.targetPokemonId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
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

  switch (outcome.kind) {
    case "not_found":
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    case "not_playing":
      return NextResponse.json(
        { error: "Game is not in progress" },
        { status: 400 }
      );
    case "not_in_room":
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 }
      );
    case "already_finished":
      return NextResponse.json(
        { error: "You have already finished" },
        { status: 400 }
      );
    case "ok":
      return NextResponse.json({
        message: "You gave up",
        targetPokemonId: outcome.targetPokemonId,
      });
  }
}
