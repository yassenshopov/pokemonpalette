import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { DIFFICULTIES, todayUtcDateString } from "@/lib/game/similarity";

// GET — the caller's row + immediate neighbors for the day's puzzle,
// plus their all-time current streak (so the UI can show the small
// streak badge on their row, à la LinkedIn).
//
// NOT edge-cacheable: the response is keyed on the caller's identity.
// `Cache-Control: private, no-store` belt-and-suspenders this past any
// future caching layer.

const QuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  // ±N neighbors above and below the caller. Capped server-side so a
  // bug in the client can't inflate the response into a full-table
  // sandwich.
  neighbors: z.coerce.number().int().min(0).max(5).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
});

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
    date: req.nextUrl.searchParams.get("date") ?? undefined,
    neighbors: req.nextUrl.searchParams.get("neighbors") ?? undefined,
    difficulty: req.nextUrl.searchParams.get("difficulty") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const date = parsed.data.date ?? todayUtcDateString();
  const neighbors = parsed.data.neighbors ?? 2;
  const difficulty = parsed.data.difficulty ?? "easy";

  const { data, error } = await supabaseAdmin.rpc(
    "daily_puzzle_leaderboard_me",
    {
      p_date: date,
      p_user_id: userId,
      p_neighbors: neighbors,
      p_difficulty: difficulty,
    }
  );

  if (error) {
    logger.error("leaderboard_me.rpc_failed", {
      userId,
      date,
      difficulty,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch user rank" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
