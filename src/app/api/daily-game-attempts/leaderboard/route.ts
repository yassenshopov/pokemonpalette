import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

// GET - Get leaderboard data
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10;
    const sortBy = searchParams.get("sortBy") || "currentStreak"; // currentStreak, winRate, totalWins, averageAttempts

    // Get all game attempts
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
      return NextResponse.json({ leaderboard: [] });
    }

    // Get unique user IDs
    const userIds = [...new Set(attempts.map((a: any) => a.user_id))];

    // Fetch user data
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, username, first_name, last_name, image_url")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching users for leaderboard:", usersError);
    }

    // Create user map for quick lookup
    const userMap = new Map();
    if (users) {
      users.forEach((user: any) => {
        userMap.set(user.id, user);
      });
    }

    // Group attempts by user and calculate stats
    const userStats = new Map<string, {
      userId: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      attempts: any[];
      dates: Set<string>;
    }>();

    attempts.forEach((attempt: any) => {
      const userId = attempt.user_id;
      const user = userMap.get(userId);

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId,
          username: user?.username || null,
          firstName: user?.first_name || null,
          lastName: user?.last_name || null,
          imageUrl: user?.image_url || null,
          attempts: [],
          dates: new Set(),
        });
      }

      const stats = userStats.get(userId)!;
      stats.attempts.push(attempt);
      stats.dates.add(attempt.date);
    });

    // Calculate statistics for each user
    const leaderboard: LeaderboardEntry[] = Array.from(userStats.values()).map((stats) => {
      const sortedAttempts = [...stats.attempts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const totalGames = stats.dates.size;
      const totalWins = stats.attempts.filter((a: any) => a.won).length;
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
      const averageAttempts = stats.attempts.length > 0
        ? stats.attempts.reduce((sum: number, a: any) => sum + a.attempts, 0) / stats.attempts.length
        : 0;

      // Calculate current streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentStreak = 0;
      let expectedDate = new Date(today);
      let foundToday = false;

      for (const attempt of sortedAttempts) {
        const attemptDate = new Date(attempt.date);
        attemptDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          currentStreak = 1;
          expectedDate = new Date(attemptDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
          foundToday = true;
        } else if (daysDiff === 1 && foundToday) {
          currentStreak++;
          expectedDate = new Date(attemptDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else if (daysDiff === currentStreak && foundToday) {
          currentStreak++;
          expectedDate = new Date(attemptDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else if (foundToday) {
          break;
        }
      }

      // Calculate longest streak
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
        
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          currentLongest++;
          longestStreak = Math.max(longestStreak, currentLongest);
        } else {
          currentLongest = 1;
        }
      }

      return {
        userId: stats.userId,
        username: stats.username,
        firstName: stats.firstName,
        lastName: stats.lastName,
        imageUrl: stats.imageUrl,
        totalGames,
        totalWins,
        winRate: Math.round(winRate * 100) / 100,
        currentStreak,
        longestStreak,
        averageAttempts: Math.round(averageAttempts * 100) / 100,
      };
    });

    // Sort leaderboard based on sortBy parameter
    leaderboard.sort((a, b) => {
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

    // Get current user's position
    let currentUser: LeaderboardEntry | null = null;
    let currentUserPosition: number | null = null;

    try {
      const authResult = await auth();
      if (authResult.userId) {
        const userEntry = leaderboard.find((entry) => entry.userId === authResult.userId);
        if (userEntry) {
          currentUser = userEntry;
          currentUserPosition = leaderboard.indexOf(userEntry) + 1;
        }
      }
    } catch (authError) {
      // User not authenticated, that's fine
    }

    return NextResponse.json({
      leaderboard: leaderboard.slice(0, limit),
      currentUser,
      currentUserPosition,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/daily-game-attempts/leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

