import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma, prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const joinLimiter = rateLimit("mp-room-join", {
  requests: 20,
  window: "1 m",
});

const MAX_PLAYERS = 2;

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

  const rl = await joinLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, imageUrl: true },
  });

  const upperCode = code.toUpperCase();

  // Use a Serializable transaction so the capacity check and player
  // insert can't race against a second concurrent joiner. Before this,
  // two players hitting `/join` on a 1-slot room within the same
  // millisecond could both read `players.length === 1`, both pass the
  // capacity check, and both insert — producing a 3-player room that
  // the game logic isn't designed to handle. Serializable isolation +
  // the `(room_id, user_id)` unique constraint + the explicit
  // capacity re-check inside the transaction make this atomic.
  let outcome:
    | { kind: "joined"; roomCode: string; roomId: string }
    | { kind: "already_in"; roomCode: string; roomId: string; status: string }
    | { kind: "not_found" }
    | { kind: "expired" }
    | { kind: "not_waiting" }
    | { kind: "full" };

  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const room = await tx.multiplayerRoom.findUnique({
          where: { roomCode: upperCode },
          include: { players: true },
        });

        if (!room) return { kind: "not_found" as const };
        if (new Date() > room.expiresAt) return { kind: "expired" as const };

        // User is already in this room — idempotent re-join. Bump the
        // room to "playing" if they're the second member showing up.
        const existing = room.players.find((p) => p.userId === userId);
        if (existing) {
          if (room.status === "waiting") {
            await tx.multiplayerRoom.update({
              where: { id: room.id },
              data: { status: "playing", startedAt: new Date() },
            });
            return {
              kind: "already_in" as const,
              roomCode: room.roomCode,
              roomId: room.id,
              status: "playing",
            };
          }
          return {
            kind: "already_in" as const,
            roomCode: room.roomCode,
            roomId: room.id,
            status: room.status,
          };
        }

        if (room.status !== "waiting") {
          return { kind: "not_waiting" as const };
        }
        if (room.players.length >= MAX_PLAYERS) {
          return { kind: "full" as const };
        }

        await tx.multiplayerPlayer.create({
          data: {
            roomId: room.id,
            userId: userId!,
            username: user?.username ?? null,
            imageUrl: user?.imageUrl ?? null,
          },
        });
        await tx.multiplayerRoom.update({
          where: { id: room.id },
          data: { status: "playing", startedAt: new Date() },
        });

        return {
          kind: "joined" as const,
          roomCode: room.roomCode,
          roomId: room.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    // P2002 = unique violation on (room_id, user_id). This means a
    // concurrent request from the same user beat us to the insert —
    // treat it as a successful idempotent join rather than 500ing.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode: upperCode },
        select: { id: true, roomCode: true, status: true },
      });
      if (room) {
        return NextResponse.json({
          message: "Joined room",
          roomCode: room.roomCode,
          roomId: room.id,
          status: room.status,
        });
      }
    }
    // 40001 = Postgres serialization_failure. With Serializable
    // isolation, conflicting concurrent transactions cause one to
    // abort. The client can safely retry.
    logger.error("multiplayer.join_failed", {
      userId,
      roomCode: upperCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }

  switch (outcome.kind) {
    case "not_found":
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    case "expired":
      return NextResponse.json({ error: "Room has expired" }, { status: 410 });
    case "not_waiting":
      return NextResponse.json(
        { error: "Room is no longer accepting players" },
        { status: 400 }
      );
    case "full":
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    case "already_in":
      return NextResponse.json({
        message: "Already in room",
        roomCode: outcome.roomCode,
        roomId: outcome.roomId,
        status: outcome.status,
      });
    case "joined":
      logger.info("multiplayer.player_joined", {
        userId,
        roomCode: outcome.roomCode,
      });
      return NextResponse.json({
        message: "Joined room",
        roomCode: outcome.roomCode,
        roomId: outcome.roomId,
        status: "playing",
      });
  }
}
