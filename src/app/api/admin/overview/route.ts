import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rangeFromSearchParams,
  resolveRange,
  type RangeValue,
} from "@/lib/admin/range";

export const dynamic = "force-dynamic";

type UserMini = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  profile_image_url: string | null;
  created_at?: string;
};

type TopPlayer = {
  user_id: string;
  attempts: number;
  wins: number;
};

type RpcPayload = {
  kpis: Record<string, number>;
  series: {
    signups: Array<{ date: string; count: number }>;
    attempts: Array<{ date: string; count: number }>;
    wins: Array<{ date: string; count: number }>;
    palettes: Array<{ date: string; count: number }>;
    active: Array<{ date: string; count: number }>;
  };
  leaderboards: {
    topPlayers: TopPlayer[];
    topTargets: Array<{
      target_pokemon_id: number;
      count: number;
      wins: number;
    }>;
    topPalettePokemon: Array<{
      pokemon_id: number;
      pokemon_name: string | null;
      count: number;
    }>;
  };
  distributions: {
    attempts: Array<{ bucket: number; count: number }>;
    hints: Array<{ bucket: number; count: number }>;
  };
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const range: RangeValue = rangeFromSearchParams(req.nextUrl.searchParams);
    const resolved = resolveRange(range);

    const [rpcRes, recentSignupsRes, recentAttemptsRes] = await Promise.all([
      supabaseAdmin.rpc("admin_overview_stats", {
        p_from: resolved.fromISO,
        p_to: resolved.toISO,
        p_prev_from: resolved.prevFromISO,
        p_prev_to: resolved.prevToISO,
      }),
      supabaseAdmin
        .from("users")
        .select(
          "id, email, username, first_name, last_name, image_url, profile_image_url, created_at",
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("daily_game_attempts")
        .select(
          "id, user_id, target_pokemon_id, is_shiny, attempts, won, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (rpcRes.error) {
      console.error("admin_overview_stats error:", rpcRes.error);
      return NextResponse.json(
        { error: "Failed to aggregate overview stats." },
        { status: 500 },
      );
    }

    const payload = (rpcRes.data ?? {}) as RpcPayload;
    const recentSignups = (recentSignupsRes.data ?? []) as UserMini[];
    const recentAttempts = recentAttemptsRes.data ?? [];

    // Attach user info for both the leaderboard and the recent-attempts strip
    // in a single lookup.
    const userIds = new Set<string>();
    for (const a of recentAttempts) {
      if (a.user_id) userIds.add(a.user_id);
    }
    for (const p of payload.leaderboards?.topPlayers ?? []) {
      if (p.user_id) userIds.add(p.user_id);
    }

    let userMap = new Map<string, UserMini>();
    if (userIds.size > 0) {
      const { data } = await supabaseAdmin
        .from("users")
        .select(
          "id, email, username, first_name, last_name, image_url, profile_image_url",
        )
        .in("id", Array.from(userIds));
      userMap = new Map((data ?? []).map((u) => [u.id, u as UserMini]));
    }

    const attemptsWithUser = recentAttempts.map((a) => ({
      ...a,
      user: a.user_id ? (userMap.get(a.user_id) ?? null) : null,
    }));
    const topPlayersWithUser = (payload.leaderboards?.topPlayers ?? []).map(
      (row) => ({
        ...row,
        user: userMap.get(row.user_id) ?? null,
      }),
    );

    return NextResponse.json({
      range: {
        preset: range.preset,
        from: resolved.from,
        to: resolved.to,
        days: resolved.days,
        label: resolved.label,
      },
      kpis: payload.kpis,
      series: payload.series,
      leaderboards: {
        topPlayers: topPlayersWithUser,
        topTargets: payload.leaderboards?.topTargets ?? [],
        topPalettePokemon: payload.leaderboards?.topPalettePokemon ?? [],
      },
      distributions: payload.distributions,
      recent: {
        signups: recentSignups,
        attempts: attemptsWithUser,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/overview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
