import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const guessLimiter = rateLimit("mp-guess", {
  requests: 30,
  window: "1 m",
});

const GuessSchema = z.object({
  pokemonId: z.number().int().min(1).max(100000),
  similarity: z.number().min(0).max(1),
});

export async function POST(
  req: NextRequest,
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

  const rl = await guessLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GuessSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pokemonId, similarity } = parsed.data;

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

  if (player.attempts >= 4) {
    return NextResponse.json(
      { error: "No attempts remaining" },
      { status: 400 }
    );
  }

  const currentGuesses = Array.isArray(player.guesses) ? player.guesses : [];
  if (currentGuesses.includes(pokemonId)) {
    return NextResponse.json(
      { error: "Already guessed this Pokemon" },
      { status: 400 }
    );
  }

  const won = pokemonId === room.targetPokemonId;
  const newAttempts = player.attempts + 1;
  const isLastAttempt = newAttempts >= 4;
  const finished = won || isLastAttempt;
  const newGuesses = [...currentGuesses, pokemonId];
  const bestSimilarity = Math.max(player.bestSimilarity, similarity);

  try {
    await prisma.multiplayerPlayer.update({
      where: { id: player.id },
      data: {
        guesses: newGuesses,
        attempts: newAttempts,
        won,
        bestSimilarity,
        finishedAt: finished ? new Date() : null,
      },
    });

    if (finished) {
      const otherPlayers = room.players.filter((p) => p.userId !== userId);
      const allFinished =
        otherPlayers.length > 0 &&
        otherPlayers.every((p) => !!p.finishedAt);

      if (allFinished || won) {
        let winnerUserId: string | null = null;

        if (won) {
          const otherWinner = otherPlayers.find((p) => p.won);
          if (otherWinner && otherWinner.finishedAt) {
            winnerUserId = userId;
          } else if (!otherWinner) {
            winnerUserId = userId;
          }
        }

        if (!winnerUserId && allFinished) {
          const allPlayers = [
            { ...player, won, bestSimilarity, attempts: newAttempts },
            ...otherPlayers,
          ];
          const winners = allPlayers.filter((p) => p.won);
          if (winners.length === 1) {
            winnerUserId = winners[0].userId;
          } else if (winners.length === 0) {
            const sorted = [...allPlayers].sort(
              (a, b) => b.bestSimilarity - a.bestSimilarity
            );
            if (
              sorted[0].bestSimilarity > sorted[1]?.bestSimilarity
            ) {
              winnerUserId = sorted[0].userId;
            }
          }
        }

        if (allFinished || won) {
          await prisma.multiplayerRoom.update({
            where: { id: room.id },
            data: {
              status: "finished",
              winnerUserId,
              finishedAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      correct: won,
      attempts: newAttempts,
      finished,
      bestSimilarity,
      targetPokemonId: finished ? room.targetPokemonId : undefined,
    });
  } catch (err) {
    logger.error("multiplayer.guess_failed", {
      userId,
      roomCode: code,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to record guess" },
      { status: 500 }
    );
  }
}
