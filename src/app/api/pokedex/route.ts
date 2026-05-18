import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { resolveDailyTarget } from "@/lib/game/daily-target";
import {
  DIFFICULTIES,
  parseUtcDate,
  todayUtcDateString,
} from "@/lib/game/similarity";

// 60 catches/hour per user — generous for a fast unlimited-mode session and
// far below what scripted abuse would need to flood the table.
const writeLimiter = rateLimit("pokedex-post", {
  requests: 60,
  window: "1 h",
});

function serializeEntry(e: {
  id: string;
  userId: string;
  pokemonId: number;
  isShiny: boolean;
  mode: string;
  attempts: number;
  hintsUsed: number;
  caughtAt: Date;
}) {
  return {
    id: e.id,
    user_id: e.userId,
    pokemon_id: e.pokemonId,
    is_shiny: e.isShiny,
    mode: e.mode,
    attempts: e.attempts,
    hints_used: e.hintsUsed,
    caught_at: e.caughtAt.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// GET — return the caller's full Pokedex. Capped server-side; even a player
// who's caught every variant tops out at ~2 * 1025 entries which is well
// within reasonable payload limits.
// -----------------------------------------------------------------------------
export async function GET() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    logger.error("auth.service_unavailable", { route: "GET /api/pokedex" });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Explicit select keeps the response payload tight (the table has
    // ~half a dozen audit columns the client never reads) and avoids
    // shipping any future columns we add to clients automatically. The
    // shape here matches the `serializeEntry` contract one-to-one.
    const entries = await prisma.pokedexEntry.findMany({
      where: { userId },
      orderBy: { caughtAt: "desc" },
      take: 5000,
      select: {
        id: true,
        userId: true,
        pokemonId: true,
        isShiny: true,
        mode: true,
        attempts: true,
        hintsUsed: true,
        caughtAt: true,
      },
    });
    return NextResponse.json(
      { entries: entries.map(serializeEntry) },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (err) {
    logger.error("pokedex.fetch_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch Pokedex" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST — record a catch. Idempotent on (user, pokemon, is_shiny). For daily
// mode we cross-check the submitted (pokemonId, isShiny) against the
// server-resolved daily target so a malicious client can't claim a Pokemon
// they didn't actually catch. For unlimited mode there's no server-side
// truth (the target is generated client-side from a random seed), so we
// trust the client; abuse there only inflates the user's own Pokedex.
// -----------------------------------------------------------------------------
const PostBodySchema = z.object({
  pokemonId: z.number().int().min(1).max(100000),
  isShiny: z.boolean(),
  mode: z.enum(["daily", "unlimited"]),
  attempts: z.number().int().min(1).max(8),
  hintsUsed: z.number().int().min(0).max(10).optional().default(0),
  // Only used for daily-mode validation. Optional so unlimited callers
  // don't need to send it.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  // Daily-only — picks which difficulty's target to cross-validate
  // against. Default 'easy' preserves the legacy validation behavior for
  // any signed-out catches in localStorage that pre-date this column.
  difficulty: z.enum(DIFFICULTIES).optional().default("easy"),
});

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    logger.error("auth.service_unavailable", { route: "POST /api/pokedex" });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await writeLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(
            1,
            Math.ceil((rl.resetAt - Date.now()) / 1000)
          ).toString(),
        },
      }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { pokemonId, isShiny, mode, attempts, hintsUsed, date, difficulty } =
    parsed.data;

  // For daily mode, the server resolves the canonical target for the given
  // date + difficulty and discards the client's claim if it doesn't match.
  // We accept today or yesterday UTC so a client finishing a game across
  // the midnight boundary doesn't lose their catch.
  let effectivePokemonId = pokemonId;
  let effectiveIsShiny = isShiny;

  if (mode === "daily") {
    const todayStr = todayUtcDateString();
    const todayDate = parseUtcDate(todayStr);
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = [
      yesterdayDate.getUTCFullYear(),
      String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0"),
      String(yesterdayDate.getUTCDate()).padStart(2, "0"),
    ].join("-");
    const submittedDate = date ?? todayStr;
    if (submittedDate !== todayStr && submittedDate !== yesterdayStr) {
      return NextResponse.json(
        { error: "Daily catches may only be recorded for today or yesterday" },
        { status: 400 }
      );
    }
    const dailyTarget = await resolveDailyTarget(
      parseUtcDate(submittedDate),
      difficulty,
    );
    if (dailyTarget.pokemonId !== pokemonId) {
      return NextResponse.json(
        { error: "Submitted Pokemon does not match the daily target" },
        { status: 400 }
      );
    }
    // Honor the daily target's shiny flag — overrides take precedence over
    // the client's claim.
    effectivePokemonId = dailyTarget.pokemonId;
    effectiveIsShiny = dailyTarget.isShiny;
  }

  try {
    // Use raw upsert via Prisma's create/findUnique pair. `createMany` with
    // `skipDuplicates: true` is the cheapest "insert-or-ignore" path and
    // tells us whether we hit a fresh row (count === 1) or a duplicate
    // (count === 0) so the client can show a "new entry!" badge.
    const result = await prisma.pokedexEntry.createMany({
      data: [
        {
          userId,
          pokemonId: effectivePokemonId,
          isShiny: effectiveIsShiny,
          mode,
          attempts,
          hintsUsed,
        },
      ],
      skipDuplicates: true,
    });

    const isNew = result.count === 1;

    // Always return the canonical row, fresh or existing, so the client can
    // mark the variant as caught either way.
    const entry = await prisma.pokedexEntry.findUnique({
      where: {
        userId_pokemonId_isShiny: {
          userId,
          pokemonId: effectivePokemonId,
          isShiny: effectiveIsShiny,
        },
      },
    });

    if (!entry) {
      // Should be unreachable — createMany either inserted or matched an
      // existing row. Treat as a transient DB error.
      logger.error("pokedex.upsert_missing_after_insert", {
        userId,
        pokemonId: effectivePokemonId,
        isShiny: effectiveIsShiny,
      });
      return NextResponse.json(
        { error: "Failed to save Pokedex entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: isNew ? "New Pokedex entry saved" : "Pokedex entry already recorded",
      isNew,
      entry: serializeEntry(entry),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Defensive — createMany with skipDuplicates handles this, but a
      // racing UNIQUE collision could still surface here.
      return NextResponse.json({
        message: "Pokedex entry already recorded",
        isNew: false,
      });
    }
    logger.error("pokedex.upsert_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to save Pokedex entry" },
      { status: 500 }
    );
  }
}
