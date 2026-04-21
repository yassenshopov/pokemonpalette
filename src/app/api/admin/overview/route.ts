import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rangeFromSearchParams,
  resolveRange,
  type RangeValue,
} from "@/lib/admin/range";
import { logger } from "@/lib/logger";

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

function toUserMini(u: {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  profileImageUrl: string | null;
  createdAt?: Date;
}): UserMini {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    first_name: u.firstName,
    last_name: u.lastName,
    image_url: u.imageUrl,
    profile_image_url: u.profileImageUrl,
    ...(u.createdAt ? { created_at: u.createdAt.toISOString() } : {}),
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const range: RangeValue = rangeFromSearchParams(req.nextUrl.searchParams);
    const resolved = resolveRange(range);

    const [rpcRes, recentSignups, recentAttempts] = await Promise.all([
      supabaseAdmin.rpc("admin_overview_stats", {
        p_from: resolved.fromISO,
        p_to: resolved.toISO,
        p_prev_from: resolved.prevFromISO,
        p_prev_to: resolved.prevToISO,
      }),
      prisma.user.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          profileImageUrl: true,
          createdAt: true,
        },
      }),
      prisma.dailyGameAttempt.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          userId: true,
          targetPokemonId: true,
          isShiny: true,
          attempts: true,
          won: true,
          createdAt: true,
        },
      }),
    ]);

    if (rpcRes.error) {
      logger.error("admin.overview.rpc_failed", { error: rpcRes.error.message });
      return NextResponse.json(
        { error: "Failed to aggregate overview stats." },
        { status: 500 },
      );
    }

    const payload = (rpcRes.data ?? {}) as RpcPayload;

    // Attach user info for both the leaderboard and the recent-attempts strip
    // in a single lookup.
    const userIds = new Set<string>();
    for (const a of recentAttempts) userIds.add(a.userId);
    for (const p of payload.leaderboards?.topPlayers ?? []) {
      if (p.user_id) userIds.add(p.user_id);
    }

    let userMap = new Map<string, UserMini>();
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          profileImageUrl: true,
        },
      });
      userMap = new Map(users.map((u) => [u.id, toUserMini(u)]));
    }

    const attemptsWithUser = recentAttempts.map((a) => ({
      id: a.id,
      user_id: a.userId,
      target_pokemon_id: a.targetPokemonId,
      is_shiny: a.isShiny,
      attempts: a.attempts,
      won: a.won,
      created_at: a.createdAt.toISOString(),
      user: userMap.get(a.userId) ?? null,
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
        signups: recentSignups.map(toUserMini),
        attempts: attemptsWithUser,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("admin.overview.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
