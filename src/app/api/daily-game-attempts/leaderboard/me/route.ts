import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// GET — caller's row + rank in the global leaderboard.
//
// Used by the leaderboard UI to pin the signed-in user below the top-N
// when they're not visible. NOT edge-cacheable: the response is keyed on
// the caller's identity. We send `Cache-Control: private, no-store` to
// belt-and-suspenders past any future caching layer.
//
// Sort/window/minGames must match the values the public list endpoint was
// called with, otherwise the rank shown to the user won't match the row
// ordering of the visible board.

const QuerySchema = z.object({
  sortBy: z
    .enum(["currentStreak", "winRate", "totalWins", "averageAttempts"])
    .optional(),
  window: z.enum(["all", "week", "today"]).optional(),
  minGames: z.coerce.number().int().min(0).max(1000).optional(),
});

const DEFAULT_MIN_GAMES_FOR_WIN_RATE = 5;

export async function GET(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("auth.service_unavailable", {
      route: "/api/daily-game-attempts/leaderboard/me",
      error:
        authError instanceof Error ? authError.message : String(authError),
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse({
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
  const { sortBy = "currentStreak", window = "all" } = parsed.data;
  const minGames =
    parsed.data.minGames ??
    (sortBy === "winRate" ? DEFAULT_MIN_GAMES_FOR_WIN_RATE : 0);

  const { data, error } = await supabaseAdmin.rpc("user_leaderboard_rank", {
    p_user_id: userId,
    p_sort_by: sortBy,
    p_window: window,
    p_min_games: minGames,
  });

  if (error) {
    logger.error("leaderboard_me.rpc_failed", {
      userId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch user rank" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { me: data, meta: { sortBy, window, minGames } },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
