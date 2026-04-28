import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// GET — public leaderboard (top-N, no per-user data).
//
// Aggregation runs in Postgres via the `leaderboard_stats` RPC (see
// migration 018). The RPC accepts a date window and an optional min-games
// threshold so we can:
//   * Show "All time / This week / Today" leaderboards.
//   * Hide one-and-done players from the win-rate sort (a 1-of-1 win =
//     100% otherwise dominates the board).
//
// Response is edge-cached because the body contains only public fields.
// The cache key includes the full query string, so each (sortBy, window,
// minGames, limit) combo gets its own slot.
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z
    .enum(["currentStreak", "winRate", "totalWins", "averageAttempts"])
    .optional(),
  window: z.enum(["all", "week", "today"]).optional(),
  minGames: z.coerce.number().int().min(0).max(1000).optional(),
});

// Default min-games when sorting by winRate. Five is enough to make the
// metric meaningful without locking out engaged-but-new players. Other
// sorts ignore it (see the SQL function).
const DEFAULT_MIN_GAMES_FOR_WIN_RATE = 5;

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    window: req.nextUrl.searchParams.get("window") ?? undefined,
    minGames: req.nextUrl.searchParams.get("minGames") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const {
    limit = 10,
    sortBy = "currentStreak",
    window = "all",
  } = parsed.data;

  // Apply the default min-games guard only when it's actually relevant
  // (winRate sort). For other sorts we pass 0 so the RPC doesn't filter.
  const minGames =
    parsed.data.minGames ??
    (sortBy === "winRate" ? DEFAULT_MIN_GAMES_FOR_WIN_RATE : 0);

  const { data, error } = await supabaseAdmin.rpc("leaderboard_stats", {
    p_sort_by: sortBy,
    p_limit: limit,
    p_window: window,
    p_min_games: minGames,
  });

  if (error) {
    logger.error("leaderboard.rpc_failed", { error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      leaderboard: data ?? [],
      meta: { sortBy, window, minGames, limit },
    },
    {
      headers: {
        // IMPORTANT: response contains only public fields (user id + name +
        // aggregate stats) so it's safe to edge-cache. Under spike, the
        // origin hits at most once per minute per query-string variant.
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
