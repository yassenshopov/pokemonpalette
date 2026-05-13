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

  // We deliberately do NOT select `guesses` for every player here
  // anymore. The full guess history is sensitive intra-game state
  // (it would let an opponent see what you've already tried in real
  // time) and we only ever expose the caller's own list. Fetching it
  // for the other player(s) was both a privacy leak and a wasted
  // JSONB read on the hot path. The caller's row is fetched
  // separately below.
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

  // Non-participants get a redacted view: enough to render the
  // "join this room" affordance, NOT the full roster. Pre-hardening
  // anyone signed in could fetch usernames + avatars + scores of
  // arbitrary waiting rooms by guessing 6-char codes (1B keyspace,
  // brute-forceable across many runs). We now strip player identity
  // for non-participants and only expose the slot count, room
  // status, and host id (the host id was already round-tripped
  // through the join flow, so this is not a new disclosure).
  if (!isParticipant) {
    return NextResponse.json({
      roomCode: room.roomCode,
      roomId: room.id,
      hostUserId: room.hostUserId,
      isShiny: room.isShiny,
      status: room.status,
      playerCount: room.players.length,
      expiresAt: room.expiresAt.toISOString(),
    });
  }

  // Fetch the caller's guesses in a tiny second query — single-row
  // primary-keyed by (room_id, user_id), so the cost is negligible.
  // Pre-hardening this endpoint returned `guesses: attempts` (i.e. a
  // number cast as the same field) for non-caller players, lying
  // about the type. We now use two distinct fields with stable types:
  //   - `guesses`: number[] of Pokemon IDs, only populated for the
  //     caller's own row. Opponents never see your guess history.
  //   - `guess_count`: number, the length of the guess list. Set on
  //     every player (including the caller, for consistency) so the
  //     UI can show "opponent has guessed N times" without leaking
  //     which Pokemon they tried.
  const callerGuessesRow = await prisma.multiplayerPlayer.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
    select: { guesses: true },
  });
  const callerGuesses = Array.isArray(callerGuessesRow?.guesses)
    ? (callerGuessesRow.guesses as number[])
    : [];

  const players = room.players.map((p) => {
    const isSelf = p.userId === userId;
    return {
      userId: p.userId,
      username: p.username,
      imageUrl: p.imageUrl,
      attempts: p.attempts,
      won: p.won,
      bestSimilarity: p.bestSimilarity,
      hintsUsed: p.hintsUsed,
      finished: !!p.finishedAt,
      guesses: isSelf ? callerGuesses : [],
      guessCount: isSelf ? callerGuesses.length : p.attempts,
    };
  });

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
