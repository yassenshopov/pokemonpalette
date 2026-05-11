import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rangeFromSearchParams,
  resolveRange,
  type RangeValue,
} from "@/lib/admin/range";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type UserMini = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  profile_image_url: string | null;
};

interface SparkPoint {
  date: string;
  count: number;
}

interface TopCatcher {
  user_id: string;
  catches: number;
  shinies: number;
  species: number;
  user: UserMini | null;
}

interface TopSpecies {
  pokemon_id: number;
  catches: number;
  shiny_catches: number;
}

interface RecentCatch {
  id: string;
  user_id: string;
  pokemon_id: number;
  is_shiny: boolean;
  mode: string;
  attempts: number;
  hints_used: number;
  caught_at: string;
  user: UserMini | null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Pad a sparse daily series to span every day in [from, to). Missing days are
 * filled with 0 so charts render a continuous line instead of skipping gaps.
 */
function fillSeries(
  rows: ReadonlyArray<{ date: string; count: number }>,
  fromDate: Date,
  toExclusive: Date,
): SparkPoint[] {
  const lookup = new Map(rows.map((r) => [r.date, r.count]));
  const points: SparkPoint[] = [];
  let cursor = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
    ),
  );
  while (cursor.getTime() < toExclusive.getTime()) {
    const key = toIsoDate(cursor);
    points.push({ date: key, count: lookup.get(key) ?? 0 });
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return points;
}

function toUserMini(u: {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  profileImageUrl: string | null;
}): UserMini {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    first_name: u.firstName,
    last_name: u.lastName,
    image_url: u.imageUrl,
    profile_image_url: u.profileImageUrl,
  };
}

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const range: RangeValue = rangeFromSearchParams(req.nextUrl.searchParams);
    const resolved = resolveRange(range);

    const fromDate = new Date(resolved.fromISO);
    const toExclusive = new Date(resolved.toISO);
    const prevFrom = new Date(resolved.prevFromISO);
    const prevTo = new Date(resolved.prevToISO);

    const whereRange: Prisma.PokedexEntryWhereInput = {
      caughtAt: { gte: fromDate, lt: toExclusive },
    };
    const wherePrev: Prisma.PokedexEntryWhereInput = {
      caughtAt: { gte: prevFrom, lt: prevTo },
    };

    // ----- Parallel data fetch ------------------------------------------------

    const [
      // Range counts
      catches,
      catchesPrev,
      shinies,
      shiniesPrev,
      dailyCatches,
      unlimitedCatches,
      // Distinct catchers/species via groupBy.length — cheap with the
      // existing (user_id) / (pokemon_id) indexes.
      catchersRange,
      catchersPrev,
      speciesRange,
      speciesPrev,
      // Range averages
      avgAgg,
      // Daily series (single rollup, fanned out below)
      seriesRows,
      // All-time totals
      totalCatches,
      totalShinies,
      totalCatchers,
      totalSpecies,
      // Leaderboards
      topCatchersRaw,
      topSpeciesRaw,
      // Recent feed
      recentEntries,
    ] = await Promise.all([
      prisma.pokedexEntry.count({ where: whereRange }),
      prisma.pokedexEntry.count({ where: wherePrev }),
      prisma.pokedexEntry.count({
        where: { ...whereRange, isShiny: true },
      }),
      prisma.pokedexEntry.count({
        where: { ...wherePrev, isShiny: true },
      }),
      prisma.pokedexEntry.count({
        where: { ...whereRange, mode: "daily" },
      }),
      prisma.pokedexEntry.count({
        where: { ...whereRange, mode: "unlimited" },
      }),
      prisma.pokedexEntry.groupBy({
        by: ["userId"],
        where: whereRange,
        _count: { _all: true },
      }),
      prisma.pokedexEntry.groupBy({
        by: ["userId"],
        where: wherePrev,
        _count: { _all: true },
      }),
      prisma.pokedexEntry.groupBy({
        by: ["pokemonId"],
        where: whereRange,
        _count: { _all: true },
      }),
      prisma.pokedexEntry.groupBy({
        by: ["pokemonId"],
        where: wherePrev,
        _count: { _all: true },
      }),
      prisma.pokedexEntry.aggregate({
        where: whereRange,
        _avg: { attempts: true, hintsUsed: true },
      }),
      prisma.$queryRaw<
        Array<{
          date: string;
          catches: number;
          shinies: number;
          daily: number;
          unlimited: number;
        }>
      >`
        SELECT to_char(date_trunc('day', caught_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS catches,
               SUM(CASE WHEN is_shiny THEN 1 ELSE 0 END)::int AS shinies,
               SUM(CASE WHEN mode = 'daily' THEN 1 ELSE 0 END)::int AS daily,
               SUM(CASE WHEN mode = 'unlimited' THEN 1 ELSE 0 END)::int AS unlimited
        FROM pokedex_entries
        WHERE caught_at >= ${fromDate} AND caught_at < ${toExclusive}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.pokedexEntry.count(),
      prisma.pokedexEntry.count({ where: { isShiny: true } }),
      prisma.pokedexEntry.groupBy({ by: ["userId"], _count: { _all: true } }),
      prisma.pokedexEntry.groupBy({
        by: ["pokemonId"],
        _count: { _all: true },
      }),
      prisma.$queryRaw<
        Array<{
          user_id: string;
          catches: number;
          shinies: number;
          species: number;
        }>
      >`
        SELECT user_id,
               COUNT(*)::int                                AS catches,
               SUM(CASE WHEN is_shiny THEN 1 ELSE 0 END)::int AS shinies,
               COUNT(DISTINCT pokemon_id)::int              AS species
        FROM pokedex_entries
        WHERE caught_at >= ${fromDate} AND caught_at < ${toExclusive}
        GROUP BY user_id
        ORDER BY catches DESC
        LIMIT 10
      `,
      prisma.$queryRaw<
        Array<{
          pokemon_id: number;
          catches: number;
          shiny_catches: number;
        }>
      >`
        SELECT pokemon_id,
               COUNT(*)::int                                AS catches,
               SUM(CASE WHEN is_shiny THEN 1 ELSE 0 END)::int AS shiny_catches
        FROM pokedex_entries
        WHERE caught_at >= ${fromDate} AND caught_at < ${toExclusive}
        GROUP BY pokemon_id
        ORDER BY catches DESC
        LIMIT 16
      `,
      prisma.pokedexEntry.findMany({
        orderBy: { caughtAt: "desc" },
        take: 10,
        select: {
          id: true,
          userId: true,
          pokemonId: true,
          isShiny: true,
          mode: true,
          attempts: true,
          hintsUsed: true,
          caughtAt: true,
        },
      }),
    ]);

    // ----- Enrich with user info ---------------------------------------------

    const userIds = new Set<string>();
    for (const r of recentEntries) userIds.add(r.userId);
    for (const t of topCatchersRaw) userIds.add(t.user_id);

    const userMap = new Map<string, UserMini>();
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
      for (const u of users) userMap.set(u.id, toUserMini(u));
    }

    const topCatchers: TopCatcher[] = topCatchersRaw.map((row) => ({
      user_id: row.user_id,
      catches: row.catches,
      shinies: row.shinies,
      species: row.species,
      user: userMap.get(row.user_id) ?? null,
    }));

    const topSpecies: TopSpecies[] = topSpeciesRaw.map((row) => ({
      pokemon_id: row.pokemon_id,
      catches: row.catches,
      shiny_catches: row.shiny_catches,
    }));

    const recent: RecentCatch[] = recentEntries.map((e) => ({
      id: e.id,
      user_id: e.userId,
      pokemon_id: e.pokemonId,
      is_shiny: e.isShiny,
      mode: e.mode,
      attempts: e.attempts,
      hints_used: e.hintsUsed,
      caught_at: e.caughtAt.toISOString(),
      user: userMap.get(e.userId) ?? null,
    }));

    // ----- Series (with zero-fill) -------------------------------------------

    const catchesSeries = fillSeries(
      seriesRows.map((r) => ({ date: r.date, count: r.catches })),
      fromDate,
      toExclusive,
    );
    const shiniesSeries = fillSeries(
      seriesRows.map((r) => ({ date: r.date, count: r.shinies })),
      fromDate,
      toExclusive,
    );
    const dailySeries = fillSeries(
      seriesRows.map((r) => ({ date: r.date, count: r.daily })),
      fromDate,
      toExclusive,
    );
    const unlimitedSeries = fillSeries(
      seriesRows.map((r) => ({ date: r.date, count: r.unlimited })),
      fromDate,
      toExclusive,
    );

    return NextResponse.json({
      range: {
        preset: range.preset,
        from: resolved.from,
        to: resolved.to,
        days: resolved.days,
        label: resolved.label,
      },
      kpis: {
        catches,
        catchesPrev,
        catchers: catchersRange.length,
        catchersPrev: catchersPrev.length,
        species: speciesRange.length,
        speciesPrev: speciesPrev.length,
        shinies,
        shiniesPrev,
        dailyCatches,
        unlimitedCatches,
        avgAttempts: avgAgg._avg.attempts ?? 0,
        avgHints: avgAgg._avg.hintsUsed ?? 0,
      },
      totals: {
        catches: totalCatches,
        catchers: totalCatchers.length,
        species: totalSpecies.length,
        shinies: totalShinies,
      },
      series: {
        catches: catchesSeries,
        shinies: shiniesSeries,
        daily: dailySeries,
        unlimited: unlimitedSeries,
      },
      leaderboards: {
        topCatchers,
        topSpecies,
      },
      recent,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("admin.pokedex.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
