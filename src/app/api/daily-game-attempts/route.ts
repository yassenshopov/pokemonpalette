import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import {
  parseUtcDate,
  todayUtcDateString,
} from "@/lib/game/similarity";
import { resolveDailyTarget } from "@/lib/game/daily-target";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 30 writes/min per user is generous for legitimate play (game allows 4
// guesses/day) and tight enough to kill pathological retry loops or abuse.
const writeLimiter = rateLimit("daily-game-attempts-post", {
  requests: 30,
  window: "1 m",
});

// -----------------------------------------------------------------------------
// GET — fetch the caller's game history (bounded) + optional server-computed
// stats. Stats come from the user_game_stats SQL RPC (migration 015) so we
// don't ship the whole history just to recount it.
// -----------------------------------------------------------------------------

const GetQuerySchema = z.object({
  stats: z.enum(["true", "false"]).optional(),
  // Server-enforced upper bound on page size — prevents an attacker from
  // pulling a power user's entire history.
  limit: z.coerce.number().int().min(1).max(60).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
});

export async function GET(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("auth.service_unavailable", {
      route: "/api/daily-game-attempts",
      error: authError instanceof Error ? authError.message : String(authError),
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = GetQuerySchema.safeParse({
    stats: req.nextUrl.searchParams.get("stats") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    date: req.nextUrl.searchParams.get("date") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { stats, limit = 60, date: dateFilter } = parsed.data;
  const includeStats = stats === "true";

  // Raw fetch — bounded history. We map back to snake_case keys below so
  // existing client code that references `is_shiny`, `target_pokemon_id`,
  // etc. keeps working.
  const attemptsRaw = await prisma.dailyGameAttempt.findMany({
    where: {
      userId,
      ...(dateFilter
        ? { date: parseUtcDate(dateFilter) }
        : {}),
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  const attempts = attemptsRaw.map((a) => ({
    id: a.id,
    user_id: a.userId,
    date: a.date.toISOString().slice(0, 10),
    target_pokemon_id: a.targetPokemonId,
    is_shiny: a.isShiny,
    guesses: a.guesses,
    attempts: a.attempts,
    won: a.won,
    pokemon_guessed: a.pokemonGuessed,
    hints_used: a.hintsUsed,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  }));

  if (!includeStats) {
    return NextResponse.json({ attempts });
  }

  const { data: statsData, error: statsError } = await supabaseAdmin.rpc(
    "user_game_stats",
    { p_user_id: userId }
  );
  if (statsError) {
    logger.error("daily-game-attempts.stats_rpc_failed", {
      userId,
      error: statsError.message,
    });
    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { attempts, stats: statsData },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}

// -----------------------------------------------------------------------------
// POST — record or overwrite a daily attempt. The server is authoritative:
// it recomputes targetPokemonId, attempts, and won from the submitted date
// and guesses. Previously the client could claim any outcome.
// -----------------------------------------------------------------------------

const PostBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  isShiny: z.boolean().optional().default(false),
  // Cap guesses: the game allows 4 attempts. Cap at 8 defensively so stale
  // clients with a bug still can't dump arbitrary data into JSONB.
  guesses: z.array(z.number().int().min(1).max(100000)).min(1).max(8),
  hintsUsed: z.number().int().min(0).max(10).optional().default(0),
});

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    logger.error("auth.service_unavailable", {
      route: "POST /api/daily-game-attempts",
    });
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
  const { date, isShiny, guesses, hintsUsed } = parsed.data;

  // Only today or yesterday UTC are acceptable. Yesterday is allowed so a
  // client finishing a game as midnight rolls over doesn't lose their
  // play. Any other date is clock skew or cheating.
  const todayStr = todayUtcDateString();
  const todayDate = parseUtcDate(todayStr);
  const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = [
    yesterdayDate.getUTCFullYear(),
    String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0"),
    String(yesterdayDate.getUTCDate()).padStart(2, "0"),
  ].join("-");

  if (date !== todayStr && date !== yesterdayStr) {
    return NextResponse.json(
      { error: "Attempts may only be recorded for today or yesterday (UTC)" },
      { status: 400 }
    );
  }

  // Server-authoritative outcome — client `won`, `attempts`, `targetPokemonId`
  // are all ignored. Admin overrides take precedence over the
  // deterministic hash, so we route through the daily-target resolver.
  // Shiny mode is forced when the override pins it on; otherwise the
  // client's choice (normal/shiny in unlimited mixing) is honored.
  const parsedDate = parseUtcDate(date);
  const dailyTarget = await resolveDailyTarget(parsedDate);
  const effectiveShiny = dailyTarget.isOverride ? dailyTarget.isShiny : isShiny;
  const targetPokemonId = dailyTarget.pokemonId;
  const attempts = guesses.length;
  const won = guesses.includes(targetPokemonId);
  const pokemonGuessed = won ? targetPokemonId : null;

  try {
    const attempt = await prisma.dailyGameAttempt.upsert({
      where: { userId_date: { userId, date: parsedDate } },
      update: {
        targetPokemonId,
        isShiny: effectiveShiny,
        guesses,
        attempts,
        won,
        pokemonGuessed,
        hintsUsed,
        updatedAt: new Date(),
      },
      create: {
        userId,
        date: parsedDate,
        targetPokemonId,
        isShiny: effectiveShiny,
        guesses,
        attempts,
        won,
        pokemonGuessed,
        hintsUsed,
      },
    });

    return NextResponse.json({
      message: "Game attempt saved successfully",
      attempt: {
        id: attempt.id,
        user_id: attempt.userId,
        date: attempt.date.toISOString().slice(0, 10),
        target_pokemon_id: attempt.targetPokemonId,
        is_shiny: attempt.isShiny,
        guesses: attempt.guesses,
        attempts: attempt.attempts,
        won: attempt.won,
        pokemon_guessed: attempt.pokemonGuessed,
        hints_used: attempt.hintsUsed,
      },
    });
  } catch (err) {
    logger.error("daily-game-attempts.upsert_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to save game attempt" },
      { status: 500 }
    );
  }
}
