import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface LeaderboardEntry {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  averageAttempts: number;
}

type SortBy = "currentStreak" | "winRate" | "totalWins" | "averageAttempts";

// GET - Get leaderboard data
//
// Cached at the edge via Cache-Control below. The full-table aggregation
// is the expensive part; s-maxage=60 means we run it at most once per
// minute per sortBy/limit variant under load. See also migration 009 for
// the composite index that supports per-user streak computation.
//
// Data flow:
//   1. Fetch ALL attempts (streak math needs the full user history).
//   2. Aggregate per-user stats + sort + slice(0, limit). No name fetch yet.
//   3. Fetch user names ONLY for the final top-N. This keeps the .in()
//      query short enough to survive undici URL-length limits even when
//      thousands of users have played (which breaks the naive
//      "fetch names for everyone" approach - that's what was hitting
//      `TypeError: fetch failed` on viral days).
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawLimit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 10;
    // Clamp [1, 100]. Prevents an unauthenticated visitor from forcing a
    // huge response payload.
    const limit = Math.max(1, Math.min(100, Number.isNaN(rawLimit) ? 10 : rawLimit));
    const sortBy = (searchParams.get("sortBy") || "currentStreak") as SortBy;

    // 1. Fetch all attempts. We need the full history for accurate streaks.
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("user_id, date, won, attempts")
      .order("date", { ascending: false });

    if (attemptsError) {
      console.error("Error fetching attempts for leaderboard:", attemptsError);
      return NextResponse.json(
        { error: "Failed to fetch leaderboard data" },
        { status: 500 }
      );
    }

    if (!attempts || attempts.length === 0) {
      return NextResponse.json(
        { leaderboard: [] },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // 2. Aggregate per user without names yet.
    type UserAttempts = {
      userId: string;
      attempts: Array<{ user_id: string; date: string; won: boolean; attempts: number }>;
      dates: Set<string>;
    };

    const userStats = new Map<string, UserAttempts>();

    for (const attempt of attempts) {
      const userId = attempt.user_id;
      let stats = userStats.get(userId);
      if (!stats) {
        stats = { userId, attempts: [], dates: new Set() };
        userStats.set(userId, stats);
      }
      stats.attempts.push(attempt);
      stats.dates.add(attempt.date);
    }

    // Compute stats for every user. Named fields left null - populated in step 4.
    const aggregated: LeaderboardEntry[] = Array.from(userStats.values()).map((stats) => {
      const sortedAttempts = [...stats.attempts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const totalGames = stats.dates.size;
      const totalWins = stats.attempts.filter((a) => a.won).length;
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
      const averageAttempts =
        stats.attempts.length > 0
          ? stats.attempts.reduce((sum, a) => sum + a.attempts, 0) /
            stats.attempts.length
          : 0;

      // Current streak. NOTE: uses local-time midnight - see P1 plan item
      // #5 (timezone consistency) for the scheduled fix.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentStreak = 0;
      let foundToday = false;

      for (const attempt of sortedAttempts) {
        const attemptDate = new Date(attempt.date);
        attemptDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (today.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
          currentStreak = 1;
          foundToday = true;
        } else if (daysDiff === 1 && foundToday) {
          currentStreak++;
        } else if (daysDiff === currentStreak && foundToday) {
          currentStreak++;
        } else if (foundToday) {
          break;
        }
      }

      // Longest streak.
      const sortedByDate = [...stats.attempts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      let longestStreak = 1;
      let currentLongest = 1;
      for (let i = 1; i < sortedByDate.length; i++) {
        const prevDate = new Date(sortedByDate[i - 1].date);
        const currDate = new Date(sortedByDate[i].date);
        prevDate.setHours(0, 0, 0, 0);
        currDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          currentLongest++;
          longestStreak = Math.max(longestStreak, currentLongest);
        } else {
          currentLongest = 1;
        }
      }

      return {
        userId: stats.userId,
        username: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        totalGames,
        totalWins,
        winRate: Math.round(winRate * 100) / 100,
        currentStreak,
        longestStreak,
        averageAttempts: Math.round(averageAttempts * 100) / 100,
      };
    });

    // 3. Sort + slice before the name fetch.
    aggregated.sort((a, b) => {
      switch (sortBy) {
        case "currentStreak":
          return b.currentStreak - a.currentStreak || b.winRate - a.winRate;
        case "winRate":
          return b.winRate - a.winRate || b.totalWins - a.totalWins;
        case "totalWins":
          return b.totalWins - a.totalWins || b.winRate - a.winRate;
        case "averageAttempts":
          return a.averageAttempts - b.averageAttempts || b.winRate - a.winRate;
        default:
          return b.currentStreak - a.currentStreak;
      }
    });

    const topN = aggregated.slice(0, limit);

    // 4. Fetch names for just the top-N. At limit <= 100 this is at most
    // ~3.5KB in the querystring - well within safe URL length limits.
    if (topN.length > 0) {
      const topIds = topN.map((e) => e.userId);
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, username, first_name, last_name, image_url")
        .in("id", topIds);

      if (usersError) {
        // Non-fatal: return the leaderboard without names rather than 500.
        // The UI falls back to "Anonymous" + initial avatar.
        console.error("Error fetching users for leaderboard:", usersError);
      } else if (users) {
        const byId = new Map<
          string,
          {
            username: string | null;
            first_name: string | null;
            last_name: string | null;
            image_url: string | null;
          }
        >();
        for (const u of users) byId.set(u.id, u);
        for (const entry of topN) {
          const u = byId.get(entry.userId);
          if (u) {
            entry.username = u.username ?? null;
            entry.firstName = u.first_name ?? null;
            entry.lastName = u.last_name ?? null;
            entry.imageUrl = u.image_url ?? null;
          }
        }
      }
    }

    // IMPORTANT: we intentionally do NOT include per-user fields tied to
    // the caller's auth in this response so it can be safely edge-cached
    // with a public Cache-Control. Clients compute their own position by
    // scanning the returned list against their Clerk userId.
    return NextResponse.json(
      { leaderboard: topN },
      {
        headers: {
          // Edge-cache leaderboard responses. 60s freshness keeps the
          // "live" feel (streaks update day-by-day, not second-by-second)
          // while ensuring a viral spike hits the origin at most once a
          // minute per cache key. stale-while-revalidate softens the
          // revalidation gap.
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error in GET /api/daily-game-attempts/leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
