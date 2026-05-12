import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getPokemonById } from "@/lib/pokemon";
import { calculateSimilarity } from "@/lib/game/similarity";

const guessLimiter = rateLimit("mp-guess", {
  requests: 30,
  window: "1 m",
});

// Note: we intentionally do NOT accept `similarity` from the client.
// Pre-hardening the route trusted whatever score the client posted,
// which let anyone PATCH `bestSimilarity: 1` and steal the win on the
// tiebreak path. The server now derives the score from the
// pre-baked per-Pokemon color palette so it's deterministic and
// tamper-proof. The client still computes its own number for the
// "you got close" UI affordance, but the source of truth lives here.
const GuessSchema = z.object({
  pokemonId: z.number().int().min(1).max(100000),
});

/** Pull the canonical palette for similarity comparison. Mirrors the
 *  client's behaviour of falling back to `colorPalette.highlights`
 *  when shiny data is missing, so a shiny game whose target lacks a
 *  shiny palette still scores correctly. */
function palette(p: {
  colorPalette?: { highlights?: string[] };
  shinyColorPalette?: { highlights?: string[] };
}, isShiny: boolean): string[] {
  if (isShiny) {
    const shiny = p.shinyColorPalette?.highlights;
    if (shiny && shiny.length > 0) return shiny;
  }
  return p.colorPalette?.highlights ?? [];
}

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

  const { pokemonId } = parsed.data;

  const room = await prisma.multiplayerRoom.findUnique({
    where: { roomCode: code.toUpperCase() },
    include: { players: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status === "finished") {
    return NextResponse.json(
      { error: "Game is already finished" },
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

  // Server-authoritative similarity. We load BOTH Pokemon (target +
  // guess), pull their canonical highlight palettes (shiny variant if
  // the room is shiny), and run the same `calculateSimilarity()` the
  // client uses for its local visual feedback. A failed lookup
  // (corrupt JSON, missing file, ID outside the bundled data set)
  // scores 0 — that's the right behaviour because we can't verify the
  // claim, and 0 won't beat any real guess on tiebreak.
  let similarity = 0;
  try {
    const [target, guess] = await Promise.all([
      getPokemonById(room.targetPokemonId),
      getPokemonById(pokemonId),
    ]);
    if (target && guess) {
      const targetColors = palette(target, room.isShiny);
      const guessColors = palette(guess, room.isShiny);
      similarity = calculateSimilarity(targetColors, guessColors);
    }
  } catch (err) {
    logger.warn("multiplayer.similarity_compute_failed", {
      pokemonId,
      targetPokemonId: room.targetPokemonId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const won = pokemonId === room.targetPokemonId;
  const newAttempts = player.attempts + 1;
  const isLastAttempt = newAttempts >= 4;
  const finished = won || isLastAttempt;
  const newGuesses = [...currentGuesses, pokemonId];
  const bestSimilarity = Math.max(player.bestSimilarity, similarity);

  // Atomicity: the player update + the (optional) room finalization
  // used to run as two separate, sequential statements. Two players
  // finishing within the same Postgres round-trip could both observe
  // an in-progress room state and then both write `status: finished`
  // with different winners — last-write-wins, leaderboard scrambled.
  // Serializable isolation forces one of the concurrent finishers to
  // get a 40001 (P2034) and retry; the loser then sees the
  // already-finished state and bails out gracefully.
  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-read the player + room INSIDE the transaction so we don't
        // mutate state based on a snapshot taken before the lock. The
        // outer `room` is used only for early-out validation; final
        // state decisions all come from this fresh read.
        const fresh = await tx.multiplayerRoom.findUnique({
          where: { id: room.id },
          include: { players: true },
        });
        if (!fresh) {
          throw new Error("Room disappeared mid-transaction");
        }
        if (fresh.status === "finished") {
          // Another participant finalised the room while we were
          // computing similarity. Skip the writes — the outer handler
          // still responds 200 with the values we have, which matches
          // the client's expectation for "this round is over".
          return;
        }

        const freshPlayer = fresh.players.find((p) => p.userId === userId);
        if (!freshPlayer) {
          throw new Error("Player vanished from room mid-transaction");
        }

        await tx.multiplayerPlayer.update({
          where: { id: freshPlayer.id },
          data: {
            guesses: newGuesses,
            attempts: newAttempts,
            won,
            bestSimilarity,
            finishedAt: finished ? new Date() : null,
          },
        });

        if (!finished) return;

        const otherPlayers = fresh.players.filter((p) => p.userId !== userId);
        const allFinished =
          otherPlayers.length > 0 &&
          otherPlayers.every((p) => !!p.finishedAt);

        if (!(allFinished || won)) return;

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
            { ...freshPlayer, won, bestSimilarity, attempts: newAttempts },
            ...otherPlayers,
          ];
          const winners = allPlayers.filter((p) => p.won);
          if (winners.length === 1) {
            const sole = winners[0];
            if (sole) winnerUserId = sole.userId;
          } else if (winners.length === 0) {
            const sorted = [...allPlayers].sort(
              (a, b) => b.bestSimilarity - a.bestSimilarity
            );
            const top = sorted[0];
            const next = sorted[1];
            if (top && next && top.bestSimilarity > next.bestSimilarity) {
              winnerUserId = top.userId;
            } else if (top && !next) {
              winnerUserId = top.userId;
            }
          }
        }

        await tx.multiplayerRoom.update({
          where: { id: fresh.id },
          data: {
            status: "finished",
            winnerUserId,
            finishedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({
      correct: won,
      attempts: newAttempts,
      finished,
      similarity,
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
