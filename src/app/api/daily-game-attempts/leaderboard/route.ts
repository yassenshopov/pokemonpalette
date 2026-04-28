import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayUtcDateString } from "@/lib/game/similarity";

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
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    date: req.nextUrl.searchParams.get("date") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const date = parsed.data.date ?? todayUtcDateString();
  const limit = parsed.data.limit ?? 10;

  const { data, error } = await supabaseAdmin.rpc("daily_puzzle_leaderboard", {
    p_date: date,
    p_limit: limit,
  });

  if (error) {
    logger.error("leaderboard.rpc_failed", { date, error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? { date, totalPlayers: 0, entries: [] }, {
    headers: {
      // Public payload, safe to share. Origin gets at most one hit per
      // minute per (date, limit) variant during a traffic spike.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
