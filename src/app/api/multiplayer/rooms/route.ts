import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const createLimiter = rateLimit("mp-room-create", {
  requests: 10,
  window: "1 m",
});

// 32-char alphabet excludes I, O, 0, 1 to avoid visual ambiguity in the
// share-the-room-code-with-a-friend UX. 32 = 2^5 so each character
// consumes exactly 5 random bits; the 6-char code carries 30 bits of
// entropy. The unique constraint on `room_code` is the ultimate guard,
// but starting from a uniform random source makes collisions
// astronomically rare under realistic concurrent-room counts.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

/**
 * Generate a candidate room code using `crypto.randomInt`. The previous
 * implementation used `Math.random()` — a non-cryptographic PRNG that's
 * not designed for collision resistance and (more importantly) is
 * predictable across short windows. Even though room-code guessing is
 * mitigated by other layers (the redacted GET, the auth check on
 * /join), starting from a CSPRNG closes the obvious "predict the next
 * code" attack and costs us nothing.
 */
function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export async function POST() {
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
  const targetPokemonId = randomInt(1, totalPokemon + 1);
  // 30% shiny rate matches the existing distribution; switched to
  // crypto.randomInt so the dice roll is non-predictable.
  const isShiny = randomInt(0, 100) < 30;

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Retry on UNIQUE-violation of room_code. Pre-hardening this looped
  // pre-check 5 times and then optimistically inserted whatever the
  // last candidate was — if that final candidate ALSO collided (race
  // with a concurrent room creation), the transaction crashed with
  // P2002 and the user got a generic 500. With 30 bits of entropy +
  // realistic concurrent-room counts the retry loop should always
  // exit on the first attempt; we keep a small bounded retry so a
  // pathological case still gives the user a clean 503 instead of a
  // crash, with no chance of an infinite loop.
  const MAX_ATTEMPTS = 8;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const roomCode = generateRoomCode();
    try {
      // Create the room AND seed the host as the first player in a
      // single transaction. The previous implementation did the two
      // inserts back-to-back without a transaction wrapper, which left
      // the room in a "host but no players row" state any time the
      // second insert failed (transient DB error, connection drop,
      // function timeout, etc.). That broken state was then exposed by
      // `/join` — the second player would see a 1-player room and join,
      // but the host could never reconnect because their player record
      // didn't exist.
      const room = await prisma.$transaction(async (tx) => {
        const created = await tx.multiplayerRoom.create({
          data: {
            roomCode,
            hostUserId: userId!,
            targetPokemonId,
            isShiny,
            status: "waiting",
            expiresAt,
          },
        });
        await tx.multiplayerPlayer.create({
          data: {
            roomId: created.id,
            userId: userId!,
            username: user?.username ?? null,
            imageUrl: user?.imageUrl ?? null,
          },
        });
        return created;
      });

      logger.info("multiplayer.room_created", { userId, roomCode });

      return NextResponse.json({
        roomCode: room.roomCode,
        roomId: room.id,
        status: room.status,
        isShiny: room.isShiny,
        expiresAt: room.expiresAt.toISOString(),
      });
    } catch (err) {
      lastErr = err;
      // P2002 = Prisma unique constraint failure. With the new CSPRNG
      // generator this should be vanishingly rare; we treat it as
      // "try again with a fresh code" rather than 500ing.
      const isUniqueViolation =
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) break;
      logger.warn("multiplayer.room_code_collision", {
        userId,
        attempt: attempt + 1,
      });
    }
  }

  logger.error("multiplayer.create_failed", {
    userId,
    attempts: MAX_ATTEMPTS,
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  return NextResponse.json(
    {
      error:
        "Failed to create room after multiple attempts. Please try again.",
    },
    { status: 503 }
  );
}
