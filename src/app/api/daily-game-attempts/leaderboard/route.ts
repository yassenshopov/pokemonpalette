import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// GET - Get leaderboard data
//
// Aggregation runs in Postgres via the `leaderboard_stats` RPC (see
// migration 015). That replaces the old full-table fetch + in-Node reduce.
// The response is still edge-cached; the RPC just makes the origin hit
// bounded-time even if the cache misses.
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z
    .enum(["currentStreak", "winRate", "totalWins", "averageAttempts"])
    .optional(),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { limit = 10, sortBy = "currentStreak" } = parsed.data;

  const { data, error } = await supabaseAdmin.rpc("leaderboard_stats", {
    p_sort_by: sortBy,
    p_limit: limit,
  });

  if (error) {
    logger.error("leaderboard.rpc_failed", { error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { leaderboard: data ?? [] },
    {
      headers: {
        // IMPORTANT: response contains only public fields (user id + name +
        // aggregate stats) so it's safe to edge-cache. Under spike, the
        // origin hits at most once per minute per (limit, sortBy) variant.
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
