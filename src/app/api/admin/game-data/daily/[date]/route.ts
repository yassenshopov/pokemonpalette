import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { getPokemonById } from "@/lib/pokemon";
import {
  DAILY_POOL_SIZE,
  getDailyPokemonIdForDate,
} from "@/lib/game/similarity";
import { FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type HistBucket = { bucket: number; count: number; wins?: number };
type TopGuess = { pokemon_id: number; count: number };

interface Kpis {
  attempts: number;
  unique_players: number;
  wins: number;
  losses: number;
  shiny_attempts: number;
  avg_attempts: number;
  avg_attempts_win: number;
  avg_hints: number;
  first_solved_at: string | null;
  fastest_attempts: number | null;
  first_play_at: string | null;
  last_play_at: string | null;
  target_pokemon_id: number | null;
}

interface StatsRpcResult {
  kpis: Kpis;
  attempts_histogram: HistBucket[];
  hints_histogram: HistBucket[];
  top_wrong_guesses: TopGuess[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { date } = await params;
  if (!ISO_DATE.test(date)) {
    return NextResponse.json(
      { error: "Invalid date. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  try {
    // Aggregates + recent plays in parallel; both are scoped to the date.
    const [statsRes, recentRes] = await Promise.all([
      supabaseAdmin.rpc("admin_daily_puzzle_stats", { p_date: date }),
      supabaseAdmin
        .from("daily_game_attempts")
        .select(
          "id, user_id, attempts, won, hints_used, is_shiny, pokemon_guessed, created_at",
        )
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (statsRes.error) {
      console.error("admin_daily_puzzle_stats failed:", statsRes.error);
      return NextResponse.json(
        { error: "Failed to load daily stats" },
        { status: 500 },
      );
    }
    if (recentRes.error) {
      console.error("recent attempts query failed:", recentRes.error);
      return NextResponse.json(
        { error: "Failed to load recent attempts" },
        { status: 500 },
      );
    }

    const stats = (statsRes.data ?? {
      kpis: {
        attempts: 0,
        unique_players: 0,
        wins: 0,
        losses: 0,
        shiny_attempts: 0,
        avg_attempts: 0,
        avg_attempts_win: 0,
        avg_hints: 0,
        first_solved_at: null,
        fastest_attempts: null,
        first_play_at: null,
        last_play_at: null,
        target_pokemon_id: null,
      },
      attempts_histogram: [],
      hints_histogram: [],
      top_wrong_guesses: [],
    }) as StatsRpcResult;

    // Fall back to the deterministic daily pick when nobody has played yet.
    const parsedDate = new Date(`${date}T00:00:00Z`);
    const targetId =
      stats.kpis.target_pokemon_id ??
      getDailyPokemonIdForDate(parsedDate, DAILY_POOL_SIZE, false);

    // Pokémon data for the mock + top-guesses previews.
    const extraIds = stats.top_wrong_guesses.map((g) => g.pokemon_id);
    const uniqueIds = Array.from(new Set<number>([targetId, ...extraIds]));
    const pokemonList = await Promise.all(
      uniqueIds.map(async (id) => {
        const p = await getPokemonById(id);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          generation: p.generation,
          rarity: p.rarity,
          colorPalette: p.colorPalette,
          shinyColorPalette: p.shinyColorPalette ?? null,
        };
      }),
    );
    const pokemonById: Record<string, unknown> = {};
    for (const p of pokemonList) {
      if (p) pokemonById[p.id] = p;
    }

    // Enrich recent attempts with display info for each player.
    const userIds = Array.from(
      new Set((recentRes.data ?? []).map((r) => r.user_id).filter(Boolean)),
    );
    const usersById = new Map<
      string,
      {
        id: string;
        email: string | null;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
        profile_image_url: string | null;
      }
    >();
    if (userIds.length > 0) {
      const { data: userRows } = await supabaseAdmin
        .from("users")
        .select(
          "id, email, username, first_name, last_name, image_url, profile_image_url",
        )
        .in("id", userIds);
      for (const u of userRows ?? []) usersById.set(u.id, u);
    }
    const recent = (recentRes.data ?? []).map((r) => ({
      ...r,
      user: usersById.get(r.user_id) ?? null,
    }));

    // Derived convenience metrics.
    const winRate =
      stats.kpis.attempts > 0
        ? stats.kpis.wins / stats.kpis.attempts
        : 0;

    const gameNumber = computeGameNumber(parsedDate);

    return NextResponse.json({
      date,
      game_number: gameNumber,
      target_pokemon_id: targetId,
      pokemon: pokemonById[targetId] ?? null,
      pokemon_by_id: pokemonById,
      kpis: {
        ...stats.kpis,
        target_pokemon_id: targetId,
        win_rate: winRate,
      },
      attempts_histogram: stats.attempts_histogram,
      hints_histogram: stats.hints_histogram,
      top_wrong_guesses: stats.top_wrong_guesses,
      recent,
    });
  } catch (err) {
    console.error("Unexpected error in GET daily puzzle stats:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function computeGameNumber(date: Date): number {
  const start = new Date(FIRST_DAILY_GAME_DATE);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const diffDays = Math.floor(
    (date.getTime() - startUtc) / (24 * 60 * 60 * 1000),
  );
  return diffDays + 1;
}
