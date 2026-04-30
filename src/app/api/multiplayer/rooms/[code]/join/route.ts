import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const joinLimiter = rateLimit("mp-room-join", {
  requests: 20,
  window: "1 m",
});

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

  const room = await prisma.multiplayerRoom.findUnique({
    where: { roomCode: code.toUpperCase() },
    include: { players: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (new Date() > room.expiresAt) {
    return NextResponse.json({ error: "Room has expired" }, { status: 410 });
  }

  if (room.players.some((p) => p.userId === userId)) {
    return NextResponse.json({
      message: "Already in room",
      roomCode: room.roomCode,
      roomId: room.id,
      status: room.status,
    });
  }

  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "Room is no longer accepting players" },
      { status: 400 }
    );
  }

  if (room.players.length >= 2) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, imageUrl: true },
  });

  try {
    await prisma.$transaction([
      prisma.multiplayerPlayer.create({
        data: {
          roomId: room.id,
          userId,
          username: user?.username ?? null,
          imageUrl: user?.imageUrl ?? null,
        },
      }),
      prisma.multiplayerRoom.update({
        where: { id: room.id },
        data: { status: "playing", startedAt: new Date() },
      }),
    ]);

    logger.info("multiplayer.player_joined", {
      userId,
      roomCode: room.roomCode,
    });

    return NextResponse.json({
      message: "Joined room",
      roomCode: room.roomCode,
      roomId: room.id,
      status: "playing",
    });
  } catch (err) {
    logger.error("multiplayer.join_failed", {
      userId,
      roomCode: room.roomCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }
}
