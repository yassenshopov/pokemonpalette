import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { DIFFICULTIES, todayUtcDateString } from "@/lib/game/similarity";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Public endpoint: no auth, so we limit per client IP. The s-maxage=60
// edge cache shields the origin for the dominant case (same date / same
// limit), but cache busters in the query string (or coordinated
// concurrent fetches) can still funnel uncached requests through to the
// RPC. 60/min is well above any honest client's polling cadence.
const leaderboardLimiter = rateLimit("daily-leaderboard", {
  requests: 60,
  window: "1 m",
});

// GET — top-N rows for a single day's puzzle.
//
// LinkedIn-style: one metric (today's score), one ordering. Players who
// want all-time stats can read them on their profile; this endpoint
// answers the only question that matters in the moment — "how did
// everyone else do today?".
//
// Edge-cached because the response contains only public fields. The
// cache key includes ?date so each puzzle's board cache lives on its
// own line and yesterday's results don't get blown away by today's.
const QuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
});

export async function GET(req: NextRequest) {
  const rl = await leaderboardLimiter.check(getClientIp(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = QuerySchema.safeParse({
    date: req.nextUrl.searchParams.get("date") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    difficulty: req.nextUrl.searchParams.get("difficulty") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const date = parsed.data.date ?? todayUtcDateString();
  const limit = parsed.data.limit ?? 10;
  const difficulty = parsed.data.difficulty ?? "easy";

  const { data, error } = await supabaseAdmin.rpc("daily_puzzle_leaderboard", {
    p_date: date,
    p_limit: limit,
    p_difficulty: difficulty,
  });

  if (error) {
    logger.error("leaderboard.rpc_failed", {
      date,
      difficulty,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    data ?? { date, difficulty, totalPlayers: 0, entries: [] },
    {
      headers: {
        // Public payload, safe to share. Origin gets at most one hit per
        // minute per (date, limit, difficulty) variant during a traffic
        // spike. Vary on the query string is implicit because the cache
        // key includes it.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
