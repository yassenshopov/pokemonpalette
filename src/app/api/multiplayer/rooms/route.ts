import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const createLimiter = rateLimit("mp-room-create", {
  requests: 10,
  window: "1 m",
});

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
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

  const rl = await createLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, imageUrl: true },
  });

  const totalPokemon = 1025;
  const targetPokemonId = Math.floor(Math.random() * totalPokemon) + 1;
  const isShiny = Math.random() < 0.3;

  let roomCode = generateRoomCode();
  let retries = 0;
  while (retries < 5) {
    const existing = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
    });
    if (!existing) break;
    roomCode = generateRoomCode();
    retries++;
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  try {
    const room = await prisma.multiplayerRoom.create({
      data: {
        roomCode,
        hostUserId: userId,
        targetPokemonId,
        isShiny,
        status: "waiting",
        expiresAt,
      },
    });

    await prisma.multiplayerPlayer.create({
      data: {
        roomId: room.id,
        userId,
        username: user?.username ?? null,
        imageUrl: user?.imageUrl ?? null,
      },
    });

    logger.info("multiplayer.room_created", { userId, roomCode });

    return NextResponse.json({
      roomCode: room.roomCode,
      roomId: room.id,
      status: room.status,
      expiresAt: room.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error("multiplayer.create_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
